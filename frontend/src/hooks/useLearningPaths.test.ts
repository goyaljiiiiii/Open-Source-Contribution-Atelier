/**
 * Tests for the useLearningPaths hooks.
 *
 * Uses vitest with React Query test utilities.
 * Does NOT execute — tests are written for coverage only.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import {
  useLearningPathList,
  useLearningPathDetail,
  useGenerateLearningPaths,
  useCompleteStep,
  useStartStep,
  useSkipStep,
  useArchivePath,
  usePathCompletionEstimate,
  usePathProgress,
} from "./useLearningPaths";
import type {
  LearningPathListItem,
  LearningPath,
  PathCompletionEstimate,
  PathProgressSnapshot,
  PathGenerateResult,
  StepCompleteResult,
} from "./useLearningPaths";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../lib/api", () => ({
  fetchApi: vi.fn(),
}));

import { fetchApi } from "../lib/api";

const mockFetchApi = vi.mocked(fetchApi);

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { queryClient, wrapper };
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const MOCK_PATH_LIST: LearningPathListItem[] = [
  {
    id: 1,
    title: "Skill Gap Recovery",
    description: "Close your weakest skill areas",
    difficulty: "beginner",
    status: "active",
    estimated_minutes: 60,
    total_steps: 4,
    completed_steps: 1,
    progress_pct: 25,
    priority_score: 85.0,
    xp_reward: 60,
    generated_at: "2026-08-01T10:00:00Z",
    next_step: {
      id: 10,
      title: "Build Docker fundamentals",
      step_type: "exercise",
      estimated_minutes: 15,
    },
  },
];

const MOCK_PATH_DETAIL: LearningPath = {
  id: 1,
  title: "Skill Gap Recovery",
  description: "Close your weakest skill areas",
  difficulty: "beginner",
  status: "active",
  target_skills: [
    { id: 1, name: "Docker", slug: "docker", icon_emoji: "🐳" },
  ],
  estimated_minutes: 60,
  total_steps: 4,
  completed_steps: 1,
  progress_pct: 25,
  is_fully_completed: false,
  xp_reward: 60,
  priority_score: 85.0,
  generated_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
  completed_at: null,
  metadata: { strategy: "skill_gap" },
  steps: [
    {
      id: 10,
      step_number: 1,
      step_type: "exercise",
      status: "completed",
      status_display: "Completed",
      title: "Build Docker fundamentals",
      description: "Docker basics practice",
      activity_type: "exercise",
      activity_id: null,
      skill_tag: { id: 1, name: "Docker", slug: "docker", icon_emoji: "🐳" },
      estimated_minutes: 15,
      xp_reward: 25,
      is_milestone: false,
      reasoning: "Skill gap detected: Docker at level 10/100",
      metadata: {},
      started_at: "2026-08-01T10:00:00Z",
      completed_at: "2026-08-01T10:15:00Z",
    },
    {
      id: 11,
      step_number: 2,
      step_type: "lesson",
      status: "not_started",
      status_display: "Not Started",
      title: "Learn Docker Compose",
      description: "Multi-container orchestration",
      activity_type: "lesson",
      activity_id: null,
      skill_tag: { id: 1, name: "Docker", slug: "docker", icon_emoji: "🐳" },
      estimated_minutes: 20,
      xp_reward: 30,
      is_milestone: false,
      reasoning: "Next step in Docker fundamentals",
      metadata: {},
      started_at: null,
      completed_at: null,
    },
    {
      id: 12,
      step_number: 3,
      step_type: "challenge",
      status: "not_started",
      status_display: "Not Started",
      title: "Docker networking challenge",
      description: "Connect containers across networks",
      activity_type: "challenge",
      activity_id: null,
      skill_tag: { id: 1, name: "Docker", slug: "docker", icon_emoji: "🐳" },
      estimated_minutes: 25,
      xp_reward: 40,
      is_milestone: true,
      reasoning: "Milestone: mastering Docker networking",
      metadata: {},
      started_at: null,
      completed_at: null,
    },
  ],
};

const MOCK_ESTIMATE: PathCompletionEstimate = {
  active_path_count: 2,
  total_remaining_steps: 8,
  daily_step_velocity: 1.2,
  estimated_completion_days: 7,
  estimated_date: "2026-09-06",
};

const MOCK_PROGRESS: PathProgressSnapshot[] = [
  {
    id: 1,
    date: "2026-08-30",
    active_path_count: 2,
    steps_completed_today: 3,
    xp_earned_today: 45,
    total_path_minutes_today: 40,
  },
];

const MOCK_GENERATE_RESULT: PathGenerateResult = {
  generated: 2,
  paths: [
    {
      path_id: 1,
      title: "Skill Gap Recovery",
      priority_score: 85.0,
      total_steps: 4,
      difficulty: "beginner",
    },
    {
      path_id: 2,
      title: "Goal Sprint",
      priority_score: 70.0,
      total_steps: 3,
      difficulty: "intermediate",
    },
  ],
};

const MOCK_STEP_COMPLETE: StepCompleteResult = {
  step_id: 10,
  status: "completed",
  xp_earned: 25,
  path_progress_pct: 50,
  path_completed: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useLearningPathList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches the path list successfully", async () => {
    mockFetchApi.mockResolvedValue(MOCK_PATH_LIST);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useLearningPathList(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].title).toBe("Skill Gap Recovery");
    expect(mockFetchApi).toHaveBeenCalledWith(
      expect.stringContaining("/learning-analytics/paths/"),
    );
  });

  it("passes status filter as query param", async () => {
    mockFetchApi.mockResolvedValue([]);
    const { wrapper } = createWrapper();

    renderHook(() => useLearningPathList("completed"), { wrapper });

    await waitFor(() => {
      expect(mockFetchApi).toHaveBeenCalledWith(
        expect.stringContaining("?status=completed"),
      );
    });
  });

  it("handles API errors gracefully", async () => {
    mockFetchApi.mockRejectedValue(new Error("Network error"));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useLearningPathList(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe("useLearningPathDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches path detail when ID is provided", async () => {
    mockFetchApi.mockResolvedValue(MOCK_PATH_DETAIL);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useLearningPathDetail(1), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data!.title).toBe("Skill Gap Recovery");
    expect(result.current.data!.steps).toHaveLength(3);
  });

  it("does not fetch when ID is null", () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useLearningPathDetail(null), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchApi).not.toHaveBeenCalled();
  });
});

describe("useGenerateLearningPaths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the generate endpoint with force=false", async () => {
    mockFetchApi.mockResolvedValue(MOCK_GENERATE_RESULT);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useGenerateLearningPaths(), {
      wrapper,
    });

    result.current.mutate({ force: false });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetchApi).toHaveBeenCalledWith(
      "/learning-analytics/paths/generate/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ force: false }),
      }),
    );
  });

  it("calls with force=true when specified", async () => {
    mockFetchApi.mockResolvedValue(MOCK_GENERATE_RESULT);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useGenerateLearningPaths(), {
      wrapper,
    });

    result.current.mutate({ force: true });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetchApi).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ force: true }),
      }),
    );
  });
});

describe("useCompleteStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completes a step and returns result", async () => {
    mockFetchApi.mockResolvedValue(MOCK_STEP_COMPLETE);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCompleteStep(), {
      wrapper,
    });

    result.current.mutate({ stepId: 10 });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data!.xp_earned).toBe(25);
    expect(result.current.data!.status).toBe("completed");
    expect(mockFetchApi).toHaveBeenCalledWith(
      "/learning-analytics/paths/steps/complete/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ step_id: 10 }),
      }),
    );
  });
});

describe("useStartStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts a step", async () => {
    mockFetchApi.mockResolvedValue({ step_id: 10, status: "in_progress" });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useStartStep(), {
      wrapper,
    });

    result.current.mutate({ stepId: 10 });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data!.status).toBe("in_progress");
  });
});

describe("useSkipStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips a step", async () => {
    mockFetchApi.mockResolvedValue({ step_id: 10, status: "skipped" });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useSkipStep(), {
      wrapper,
    });

    result.current.mutate({ stepId: 10 });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data!.status).toBe("skipped");
  });
});

describe("useArchivePath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("archives a path via DELETE", async () => {
    mockFetchApi.mockResolvedValue({ archived: true });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useArchivePath(), {
      wrapper,
    });

    result.current.mutate({ pathId: 1 });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetchApi).toHaveBeenCalledWith(
      "/learning-analytics/paths/1/archive/",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("usePathCompletionEstimate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches the estimate", async () => {
    mockFetchApi.mockResolvedValue(MOCK_ESTIMATE);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePathCompletionEstimate(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data!.active_path_count).toBe(2);
    expect(result.current.data!.estimated_completion_days).toBe(7);
  });
});

describe("usePathProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches progress with default 7 days", async () => {
    mockFetchApi.mockResolvedValue(MOCK_PROGRESS);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePathProgress(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].steps_completed_today).toBe(3);
  });

  it("passes custom days parameter", async () => {
    mockFetchApi.mockResolvedValue(MOCK_PROGRESS);
    const { wrapper } = createWrapper();

    renderHook(() => usePathProgress(14), { wrapper });

    await waitFor(() => {
      expect(mockFetchApi).toHaveBeenCalledWith(
        expect.stringContaining("days=14"),
      );
    });
  });
});
