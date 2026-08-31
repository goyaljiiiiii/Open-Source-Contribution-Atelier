import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import GitBisectGamePage from "../pages/GitBisectGamePage";
import React from "react";

afterEach(cleanup);

describe("GitBisectGamePage Performance Comparison Chart", () => {
  it("renders the git bisect debugger page", () => {
    render(<GitBisectGamePage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/git bisect/i);
  });

  it("displays step count performance comparison chart upon level completion", () => {
    render(<GitBisectGamePage />);

    const startButtons = screen.getAllByRole("button", { name: /start bisect/i });
    expect(startButtons.length).toBeGreaterThan(0);

    // Start bisect session
    fireEvent.click(startButtons[0]);

    const goodBtn = screen.getByRole("button", { name: /good/i });
    const badBtn = screen.getByRole("button", { name: /bad/i });

    // Step through bisect binary search until bad commit is isolated
    for (let i = 0; i < 6; i++) {
      if (screen.queryByText(/Regression Bug Isolated/i)) break;

      const checkedOutElements = screen.getAllByText(/Checked out/i);
      const lastCheckedOutText = checkedOutElements[checkedOutElements.length - 1]?.textContent || "";

      if (
        lastCheckedOutText.includes("12") ||
        lastCheckedOutText.includes("13") ||
        lastCheckedOutText.includes("14") ||
        lastCheckedOutText.includes("15") ||
        lastCheckedOutText.includes("16") ||
        lastCheckedOutText.includes("17") ||
        lastCheckedOutText.includes("18") ||
        lastCheckedOutText.includes("19") ||
        lastCheckedOutText.includes("20")
      ) {
        fireEvent.click(badBtn);
      } else {
        fireEvent.click(goodBtn);
      }
    }

    // Modal should appear
    expect(screen.getByText(/Regression Bug Isolated/i)).toBeInTheDocument();

    // Verify O(log N) vs O(N) performance chart elements
    expect(screen.getByText(/Performance: O\(log N\) vs O\(N\)/i)).toBeInTheDocument();
    expect(screen.getByText(/git bisect \(Binary Search\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Linear Check \(Step-by-step\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Efficiency Boost/i)).toBeInTheDocument();
  });
});
