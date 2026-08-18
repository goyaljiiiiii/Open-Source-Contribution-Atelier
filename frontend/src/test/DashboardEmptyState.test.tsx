import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { PerfChart } from "../components/admin/PerfChart";

describe("Admin Dashboard Charts Empty State Tests", () => {
  it("renders empty state message when PerfChart receives empty dataset", () => {
    render(<PerfChart data={[]} />);
    expect(screen.getByText("Latency Trends (ms)")).toBeDefined();
    expect(screen.getByText("No data for the selected period")).toBeDefined();
  });
});
