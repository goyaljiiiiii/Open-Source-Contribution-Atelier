import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { useSearchWithCategories } from "./useSearchWithCategories";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSearchWithCategories duration tracking", () => {
  it("exposes client-measured latency when backend omits meta.duration_ms", async () => {
    mockedAxios.get.mockResolvedValue({
      data: { lessons: [{ id: "1", title: "Git", category: "Git" }] },
      // no meta.duration_ms
    });

    const { result } = renderHook(() => useSearchWithCategories());

    await act(async () => {
      await result.current.search("git", null);
    });

    // State is settled once the awaited search promise resolves.
    expect(result.current.durationMs).not.toBeNull();
    expect(result.current.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.current.results).toHaveLength(1);
  });

  it("prefers backend-reported meta.duration_ms when present", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        lessons: [],
        meta: { duration_ms: 38, source: "meilisearch" },
      },
    });

    const { result } = renderHook(() => useSearchWithCategories());

    await act(async () => {
      await result.current.search("git", null);
    });

    expect(result.current.durationMs).toBe(38);
    // source === "meilisearch" means not degraded
    expect(result.current.isDegraded).toBe(false);
  });

  it("resets durationMs on clearSearch", async () => {
    mockedAxios.get.mockResolvedValue({
      data: { lessons: [{ id: "1", title: "Git", category: "Git" }] },
    });

    const { result } = renderHook(() => useSearchWithCategories());

    await act(async () => {
      await result.current.search("git", null);
    });
    expect(result.current.durationMs).not.toBeNull();

    act(() => result.current.clearSearch());
    expect(result.current.durationMs).toBeNull();
    expect(result.current.results).toHaveLength(0);
  });
});
