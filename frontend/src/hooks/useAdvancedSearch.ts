import { useState, useCallback, useRef } from "react";
import { fetchApi } from "../lib/api";

export interface AdvancedSearchResult {
  id: string | number;
  title: string;
  description: string;
  content_type?: string;
  relevance_score?: number;
  semantic_score?: number;
  tags?: string[];
  [key: string]: any;
}

export interface UseAdvancedSearchResult {
  results: AdvancedSearchResult[];
  loading: boolean;
  error: Error | null;
  total: number;
  filterSuggestions: Record<string, string[]> | null;
  relevanceScores: {
    average: number;
    high: number;
  };
  search: (query: string, filters?: Record<string, any>) => Promise<void>;
  clearSearch: () => void;
}

export function useAdvancedSearch(): UseAdvancedSearchResult {
  const [results, setResults] = useState<AdvancedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [filterSuggestions, setFilterSuggestions] = useState<Record<string, string[]> | null>(null);
  const [relevanceScores, setRelevanceScores] = useState({ average: 0, high: 0 });

  const abortControllerRef = useRef<AbortController | null>(null);

  const clearSearch = useCallback(() => {
    setResults([]);
    setTotal(0);
    setError(null);
    setLoading(false);
    setFilterSuggestions(null);
    setRelevanceScores({ average: 0, high: 0 });
  }, []);

  const search = useCallback(
    async (query: string, filters: Record<string, any> = {}) => {
      if (!query || query.trim().length < 2) {
        clearSearch();
        return;
      }

      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ q: query.trim() });
        if (filters.type) {
          params.append("type", filters.type);
        }
        if (filters.category) {
          params.append("category", filters.category);
        }

        const data = await fetchApi(`/search/?${params.toString()}`, {
          signal: abortControllerRef.current.signal,
        });

        const rawResults: any[] = Array.isArray(data)
          ? data
          : data?.results || [];

        const mappedResults: AdvancedSearchResult[] = rawResults.map((item: any, index: number) => {
          const score = typeof item.rank === "number" ? item.rank : (item.relevance_score ?? 0.8);
          return {
            id: item.id ?? item.pk ?? `result-${index}`,
            title: item.title || item.headline || "Untitled",
            description: item.description || item.body || item.summary || "",
            content_type: item.content_type || item.type || "lesson",
            relevance_score: score,
            semantic_score: item.semantic_score ?? undefined,
            tags: item.tags || [],
            ...item,
          };
        });

        setResults(mappedResults);
        const count = typeof data?.count === "number" ? data.count : mappedResults.length;
        setTotal(count);

        // Compute relevance stats
        if (mappedResults.length > 0) {
          const scores = mappedResults.map((r) => r.relevance_score || 0);
          const avg = scores.reduce((acc, s) => acc + s, 0) / scores.length;
          const highCount = scores.filter((s) => s >= 0.7).length;
          setRelevanceScores({ average: avg, high: highCount });
        } else {
          setRelevanceScores({ average: 0, high: 0 });
        }
      } catch (err: any) {
        if (err?.name === "AbortError" || err?.code === "ERR_CANCELED") {
          return;
        }
        setError(err instanceof Error ? err : new Error(String(err)));
        setResults([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [clearSearch],
  );

  return {
    results,
    loading,
    error,
    total,
    filterSuggestions,
    relevanceScores,
    search,
    clearSearch,
  };
}
