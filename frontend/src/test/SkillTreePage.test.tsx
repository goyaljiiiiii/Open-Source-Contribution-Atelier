import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SkillTreePage } from "../pages/SkillTreePage";

describe("SkillTreePage XP handling and mounted guard", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("correctly handles and renders 0 XP when API returns 0 XP", async () => {
    const mockData = {
      nodes: [
        {
          id: "custom-node-1",
          title: "First Step",
          domain: "open_source",
          category: "General",
          description: "Starting node",
          prerequisites: [],
          status: "unlocked",
          xp_reward: 100,
          difficulty: "Beginner",
          position: { x: 100, y: 100 },
        },
      ],
      edges: [],
      user_xp: 0,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    render(<SkillTreePage />);

    await waitFor(() => {
      expect(screen.getByText("0")).toBeInTheDocument();
    });
  });

  it("renders positive XP when API returns non-zero user_xp", async () => {
    const mockData = {
      nodes: [],
      edges: [],
      user_xp: 850,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    render(<SkillTreePage />);

    await waitFor(() => {
      expect(screen.getByText("850")).toBeInTheDocument();
    });
  });

  it("falls back to default nodes and default XP when fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));

    render(<SkillTreePage />);

    await waitFor(() => {
      // Default XP is 1250 on offline fallback
      expect(screen.getByText("1250")).toBeInTheDocument();
      expect(screen.getByText(/Git Basics & CLI Setup/i)).toBeInTheDocument();
    });
  });

  it("aborts in-flight request when component unmounts", () => {
    const abortSpy = vi.fn();
    const mockFetch = vi.fn().mockImplementation((_url, options) => {
      if (options?.signal) {
        options.signal.addEventListener("abort", abortSpy);
      }
      return new Promise(() => {}); // Never resolves
    });

    global.fetch = mockFetch;

    const { unmount } = render(<SkillTreePage />);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    unmount();
    expect(abortSpy).toHaveBeenCalled();
  });

  it("triggers re-fetch when refresh button is clicked", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ nodes: [], edges: [], user_xp: 200 }),
    });

    global.fetch = mockFetch;

    render(<SkillTreePage />);

    await waitFor(() => {
      expect(screen.getByText("200")).toBeInTheDocument();
    });

    const refreshBtn = screen.getByRole("button", { name: /refresh skill tree data/i });
    fireEvent.click(refreshBtn);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
