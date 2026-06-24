import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { ScrollToTop } from "../components/ui/ScrollToTop";

describe("ScrollToTop Component", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollY", "get").mockReturnValue(0);
    vi.stubGlobal("scrollTo", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("is initially hidden when scroll position is 0", () => {
    render(<ScrollToTop />);
    const button = screen.queryByTestId("scroll-to-top");
    expect(button).not.toBeInTheDocument();
  });

  it("appears when scrolled past the threshold", () => {
    render(<ScrollToTop />);
    act(() => {
      Object.defineProperty(window, "scrollY", { value: 350, configurable: true, writable: true });
      window.dispatchEvent(new Event("scroll"));
    });

    // Simulate scrolling down
    Object.defineProperty(window, "scrollY", { value: 350, writable: true });
    window.dispatchEvent(new Event("scroll"));

    const button = screen.getByTestId("scroll-to-top");
    expect(button).toBeInTheDocument();
  });

  it("disappears when scrolled back up", () => {
    render(<ScrollToTop />);

    // Scroll down
    act(() => {
      Object.defineProperty(window, "scrollY", { value: 350, configurable: true, writable: true });
      window.dispatchEvent(new Event("scroll"));
    });
    expect(screen.getByTestId("scroll-to-top")).toBeInTheDocument();

    // Scroll up
    act(() => {
      Object.defineProperty(window, "scrollY", { value: 100, configurable: true, writable: true });
      window.dispatchEvent(new Event("scroll"));
    });
    expect(screen.queryByTestId("scroll-to-top")).not.toBeInTheDocument();
  });

  it("scrolls to top smoothly when clicked", () => {
    render(<ScrollToTop />);
    act(() => {
      Object.defineProperty(window, "scrollY", { value: 400, configurable: true, writable: true });
      window.dispatchEvent(new Event("scroll"));
    });

    Object.defineProperty(window, "scrollY", { value: 400, writable: true });
    window.dispatchEvent(new Event("scroll"));

    const button = screen.getByTestId("scroll-to-top");
    fireEvent.click(button);

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
  });
});
