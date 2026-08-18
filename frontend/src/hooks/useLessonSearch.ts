import { useState, useEffect, useMemo, useCallback } from "react";
import { fetchCurriculum, flattenCurriculumLessons, CurriculumLesson } from "../lib/curriculum";

export interface SearchResultItem {
  slug: string;
  title: string;
  moduleTitle: string;
  description: string;
  matchingSnippet: string;
  matchType: "title" | "body" | "code" | "description";
  relevanceScore: number;
}

/**
 * Perform fuzzy matching between target and query strings.
 * Returns true if characters appear in order with allowed distance.
 */
function fuzzyMatch(text: string, query: string): boolean {
  const cleanText = text.toLowerCase();
  const cleanQuery = query.toLowerCase().trim();
  if (!cleanQuery) return false;
  if (cleanText.includes(cleanQuery)) return true;

  let queryIdx = 0;
  for (let i = 0; i < cleanText.length && queryIdx < cleanQuery.length; i++) {
    if (cleanText[i] === cleanQuery[queryIdx]) {
      queryIdx++;
    }
  }
  return queryIdx === cleanQuery.length;
}

/**
 * Generate a text snippet with matching terms highlighted.
 */
export function highlightText(text: string, query: string, maxSnippetLength = 120): string {
  if (!text || !query.trim()) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex === -1) {
    return text.length > maxSnippetLength ? text.slice(0, maxSnippetLength) + "..." : text;
  }

  const start = Math.max(0, matchIndex - 30);
  const end = Math.min(text.length, matchIndex + lowerQuery.length + 50);

  let snippet = text.slice(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";

  return snippet;
}

/**
 * Custom React hook for indexing and full-text searching curriculum lessons.
 */
export function useLessonSearch() {
  const [lessons, setLessons] = useState<(CurriculumLesson & { moduleTitle: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchCurriculum()
      .then((curriculum) => {
        if (!isMounted) return;
        const allLessons: (CurriculumLesson & { moduleTitle: string })[] = [];
        curriculum.modules.forEach((mod) => {
          mod.lessons.forEach((l) => {
            allLessons.push({
              ...l,
              moduleTitle: mod.title,
            });
          });
        });
        setLessons(allLessons);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("[useLessonSearch] Failed to load curriculum:", err);
        setError("Failed to load curriculum search index.");
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const search = useCallback(
    (query: string): SearchResultItem[] => {
      const q = query.trim().toLowerCase();
      if (!q || lessons.length === 0) return [];

      const results: SearchResultItem[] = [];

      for (const lesson of lessons) {
        const titleLower = lesson.title.toLowerCase();
        const descLower = (lesson.description || "").toLowerCase();
        const expectedLower = (lesson.expected || "").toLowerCase();
        const hintLower = (lesson.hint || "").toLowerCase();

        let score = 0;
        let matchType: "title" | "body" | "code" | "description" = "description";
        let snippet = lesson.description || "";

        // 1. Exact title match
        if (titleLower === q) {
          score += 100;
          matchType = "title";
          snippet = lesson.title;
        }
        // 2. Partial title match
        else if (titleLower.includes(q)) {
          score += 80;
          matchType = "title";
          snippet = lesson.title;
        }
        // 3. Fuzzy title match
        else if (fuzzyMatch(titleLower, q)) {
          score += 65;
          matchType = "title";
          snippet = lesson.title;
        }
        // 4. Description match
        else if (descLower.includes(q)) {
          score += 50;
          matchType = "description";
          snippet = highlightText(lesson.description || "", q);
        }
        // 5. Code / Expected output / Hint match
        else if (expectedLower.includes(q) || hintLower.includes(q)) {
          score += 40;
          matchType = "code";
          snippet = highlightText(lesson.expected || lesson.hint || "", q);
        }
        // 6. Fuzzy description match
        else if (fuzzyMatch(descLower, q)) {
          score += 30;
          matchType = "body";
          snippet = highlightText(lesson.description || "", q);
        }

        if (score > 0) {
          results.push({
            slug: lesson.slug,
            title: lesson.title,
            moduleTitle: lesson.moduleTitle,
            description: lesson.description || "",
            matchingSnippet: snippet,
            matchType,
            relevanceScore: score,
          });
        }
      }

      // Sort by relevance score descending
      return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    },
    [lessons],
  );

  return {
    lessons,
    loading,
    error,
    search,
  };
}
