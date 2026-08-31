import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LearningPathStep {
  id: number;
  step_number: number;
  step_type: string;
  status: string;
  status_display: string;
  title: string;
  description: string;
  activity_type: string | null;
  activity_id: number | null;
  skill_tag: {
    id: number;
    name: string;
    slug: string;
    icon_emoji: string;
  } | null;
  estimated_minutes: number;
  xp_reward: number;
  is_milestone: boolean;
  reasoning: string;
  metadata: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
}

export interface LearningPath {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  status: string;
  target_skills: Array<{
    id: number;
    name: string;
    slug: string;
    icon_emoji: string;
  }>;
  estimated_minutes: number;
  total_steps: number;
  completed_steps: number;
  progress_pct: number;
  is_fully_completed: boolean;
  xp_reward: number;
  priority_score: number;
  generated_at: string;
  updated_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  steps: LearningPathStep[];
}

export interface LearningPathListItem {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  status: string;
  estimated_minutes: number;
  total_steps: number;
  completed_steps: number;
  progress_pct: number;
  priority_score: number;
  xp_reward: number;
  generated_at: string;
  next_step: {
    id: number;
    title: string;
    step_type: string;
    estimated_minutes: number;
  } | null;
}

export interface PathCompletionEstimate {
  active_path_count: number;
  total_remaining_steps: number;
  daily_step_velocity: number;
  estimated_completion_days: number;
  estimated_date: string | null;
}

export interface PathProgressSnapshot {
  id: number;
  date: string;
  active_path_count: number;
  steps_completed_today: number;
  xp_earned_today: number;
  total_path_minutes_today: number;
}

export interface PathGenerateResult {
  generated: number;
  paths: Array<{
    path_id: number;
    title: string;
    priority_score: number;
    total_steps: number;
    difficulty: string;
  }>;
}

export interface StepCompleteResult {
  step_id: number;
  status: string;
  xp_earned: number;
  path_progress_pct: number;
  path_completed: boolean;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all learning paths (lightweight list view).
 */
export function useLearningPathList(statusFilter?: string) {
  return useQuery<LearningPathListItem[]>({
    queryKey: ["learningPaths", "list", statusFilter],
    queryFn: () => {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      return fetchApi(`/learning-analytics/paths/${params}`);
    },
  });
}

/**
 * Fetch full details of a single learning path (with steps).
 */
export function useLearningPathDetail(pathId: number | null) {
  return useQuery<LearningPath>({
    queryKey: ["learningPaths", "detail", pathId],
    queryFn: () => fetchApi(`/learning-analytics/paths/${pathId}/`),
    enabled: pathId !== null,
  });
}

/**
 * Generate new personalised learning paths.
 */
export function useGenerateLearningPaths() {
  const queryClient = useQueryClient();
  return useMutation<PathGenerateResult, Error, { force?: boolean }>({
    mutationFn: (variables) =>
      fetchApi("/learning-analytics/paths/generate/", {
        method: "POST",
        body: JSON.stringify({ force: variables.force ?? false }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learningPaths"] });
    },
  });
}

/**
 * Complete a learning path step.
 */
export function useCompleteStep() {
  const queryClient = useQueryClient();
  return useMutation<StepCompleteResult, Error, { stepId: number }>({
    mutationFn: (variables) =>
      fetchApi("/learning-analytics/paths/steps/complete/", {
        method: "POST",
        body: JSON.stringify({ step_id: variables.stepId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learningPaths"] });
    },
  });
}

/**
 * Start a learning path step (mark in-progress).
 */
export function useStartStep() {
  const queryClient = useQueryClient();
  return useMutation<{ step_id: number; status: string }, Error, { stepId: number }>({
    mutationFn: (variables) =>
      fetchApi("/learning-analytics/paths/steps/start/", {
        method: "POST",
        body: JSON.stringify({ step_id: variables.stepId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learningPaths"] });
    },
  });
}

/**
 * Skip a learning path step.
 */
export function useSkipStep() {
  const queryClient = useQueryClient();
  return useMutation<{ step_id: number; status: string }, Error, { stepId: number }>({
    mutationFn: (variables) =>
      fetchApi("/learning-analytics/paths/steps/skip/", {
        method: "POST",
        body: JSON.stringify({ step_id: variables.stepId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learningPaths"] });
    },
  });
}

/**
 * Archive a learning path.
 */
export function useArchivePath() {
  const queryClient = useQueryClient();
  return useMutation<{ archived: boolean }, Error, { pathId: number }>({
    mutationFn: (variables) =>
      fetchApi(`/learning-analytics/paths/${variables.pathId}/archive/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learningPaths"] });
    },
  });
}

/**
 * Get completion estimate for all active paths.
 */
export function usePathCompletionEstimate() {
  return useQuery<PathCompletionEstimate>({
    queryKey: ["learningPaths", "estimate"],
    queryFn: () => fetchApi("/learning-analytics/paths/estimate/"),
  });
}

/**
 * Get recent path progress snapshots.
 */
export function usePathProgress(days: number = 7) {
  return useQuery<PathProgressSnapshot[]>({
    queryKey: ["learningPaths", "progress", days],
    queryFn: () => fetchApi(`/learning-analytics/paths/progress/?days=${days}`),
  });
}
