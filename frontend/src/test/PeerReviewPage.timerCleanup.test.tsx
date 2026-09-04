import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import toast from "react-hot-toast";
import { PeerReviewPage } from "../pages/PeerReviewPage";
import * as apiModule from "../lib/api";

// Fake timers are enabled globally by src/test/setup.ts, so this file only
// advances them — it never calls vi.useFakeTimers / vi.useRealTimers itself.

// react-hot-toast is imported both as a named export (PeerReviewPage) and as a
// default export (lib/api), so the mock must provide both shapes.
vi.mock("react-hot-toast", () => {
  const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    custom: vi.fn(),
  };
  return {
    __esModule: true,
    default: mockToast,
    toast: mockToast,
    Toaster: () => null,
  };
});

vi.mock("../hooks/useUserProgress", () => ({
  useUserProgress: () => ({ syncProgress: vi.fn() }),
}));

vi.mock("../features/auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, username: "test_user" } }),
}));

vi.mock("../hooks/useTheme", () => ({
  useTheme: () => ({ theme: "light" }),
}));

const successToast = toast.success as ReturnType<typeof vi.fn>;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PeerReviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function submitPatch() {
  fireEvent.change(
    screen.getByPlaceholderText("e.g. Optimized AVL Tree Insertion"),
    { target: { value: "My patch" } },
  );
  fireEvent.change(
    screen.getByPlaceholderText("Paste your modified code snippet here..."),
    { target: { value: "const answer = 42;" } },
  );
  fireEvent.click(screen.getByRole("button", { name: /Analyze with AI Peer/ }));
  // Flush the awaited POST inside handleSubmitCode so the timer chain starts.
  await act(async () => {
    await Promise.resolve();
  });
}

describe("PeerReviewPage — AI animation timer cleanup (issue #2608)", () => {
  beforeEach(() => {
    vi.spyOn(apiModule, "fetchApi").mockResolvedValue({});
    successToast.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("completes the AI review when the page stays mounted", async () => {
    renderPage();
    await submitPatch();

    // The animation runs three 1s steps before finishing.
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(successToast).toHaveBeenCalledWith("AI Code Review completed! 🤖");
  });

  it("cancels pending animation timers when the page unmounts", async () => {
    const { unmount } = renderPage();
    await submitPatch();

    // Run the first step, which schedules the next timer in the chain...
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // ...then leave the page before the chain finishes.
    unmount();
    successToast.mockClear();

    // Before the fix, an orphaned setTimeout would fire here, call setState on
    // the unmounted component and reach toast.success. After the fix, the
    // useEffect cleanup has cancelled every pending timer.
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(successToast).not.toHaveBeenCalled();
  });
});
