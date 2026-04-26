import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";

export interface ProgressEntry {
  id: number;
  lesson: number;
  lesson_slug: string; // We'll need to modify the serializer to include this or handle it
  completed: boolean;
  score: number;
  updated_at: string;
}

export function useUserProgress() {
  const queryClient = useQueryClient();

  // 1. Query to fetch all progress
  const { data: progress = [], isLoading } = useQuery<ProgressEntry[]>({
    queryKey: ["userProgress"],
    queryFn: () => fetchApi("/progress/me/"),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // 2. Mutation to sync completion
  const syncMutation = useMutation({
    mutationFn: (vars: { lesson_slug: string; score?: number; completed?: boolean }) =>
      fetchApi("/progress/me/", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ["userProgress"] });
    },
  });

  // 3. Convenience helpers
  const isLessonCompleted = (slug: string) => {
    // Assuming backend returns related lesson data or slug
    // If not, we might need to adjust the serializer
    return progress.some((p) => p.lesson_slug === slug && p.completed);
  };

  const totalXP = progress.reduce((acc, p) => acc + p.score, 0);

  return {
    progress,
    isLoading,
    isLessonCompleted,
    totalXP,
    syncProgress: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
  };
}
