/**
 * useGoodFirstIssues.ts
 * Debounced GitHub issue search with client cache + AbortController.
 */
import { useEffect, useState } from "react";
import {
  GoodFirstIssueFilters,
  RankedIssue,
  normalizeFilters,
  rankAndFilterIssues,
  searchGitHubIssues,
} from "../lib/goodFirstIssueFinder";

const DEBOUNCE_MS = 450;

export const TOPIC_FILTERS = [
  "All Topics",
  "Python",
  "React",
  "Django",
  "Docker",
  "Documentation",
] as const;

export type TopicFilter = (typeof TOPIC_FILTERS)[number];

/**
 * Client-side filter that instantly narrows already-fetched issues down
 * to a single topic chip, without triggering a new GitHub API search.
 */
export function filterIssuesByTopic(
  issues: RankedIssue[],
  topic: TopicFilter,
): RankedIssue[] {
  if (topic === "All Topics") return issues;

  const needle = topic.toLowerCase();
  return issues.filter((issue) => {
    const haystack = [
      issue.title,
      issue.body ?? "",
      issue.repoFullName,
      ...issue.labels.map((l) => l.name),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export interface UseGoodFirstIssuesResult {
  issues: RankedIssue[];
  isLoading: boolean;
  error: string | null;
  fromCache: boolean;
  totalCount: number;
  refetch: () => void;
}

export function useGoodFirstIssues(
  filters: GoodFirstIssueFilters,
): UseGoodFirstIssuesResult {
  const [issues, setIssues] = useState<RankedIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [debounced, setDebounced] = useState(() => normalizeFilters(filters));
  const [reloadIndex, setReloadIndex] = useState(0);

  const refetch = () => setReloadIndex((prev) => prev + 1);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(normalizeFilters(filters));
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [filters]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function run() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await searchGitHubIssues(debounced, controller.signal);
        if (cancelled) return;
        const ranked = rankAndFilterIssues(result.items, debounced);
        setIssues(ranked);
        setFromCache(result.fromCache);
        setTotalCount(result.totalCount);
      } catch (err) {
        if (
          cancelled ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          return;
        }
        if (!cancelled) {
          setIssues([]);
          setError(
            err instanceof Error ? err.message : "Failed to search GitHub",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debounced, reloadIndex]);

  return { issues, isLoading, error, fromCache, totalCount, refetch };
}
