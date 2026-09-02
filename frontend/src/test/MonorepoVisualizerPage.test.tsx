import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import MonorepoVisualizerPage from "../pages/MonorepoVisualizerPage";
import React from "react";

afterEach(cleanup);

describe("MonorepoVisualizerPage Package Filtering", () => {
  it("renders the monorepo visualizer page with 2D graph and search controls", () => {
    render(<MonorepoVisualizerPage />);

    expect(screen.getByPlaceholderText(/Filter packages by workspace name.../i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Filter packages by workspace name/i })).toBeInTheDocument();
  });

  it("filters graph nodes by target package workspace and shows reset button", () => {
    render(<MonorepoVisualizerPage />);

    const searchInput = screen.getByPlaceholderText(/Filter packages by workspace name.../i);
    fireEvent.change(searchInput, { target: { value: "@atelier/frontend" } });

    // Reset button should now be visible
    const resetButton = screen.getByRole("button", { name: /Reset Filter/i });
    expect(resetButton).toBeInTheDocument();

    // Click Reset filter button
    fireEvent.click(resetButton);

    // Search input should be cleared and Reset button hidden
    expect(searchInput).toHaveValue("");
    expect(screen.queryByRole("button", { name: /Reset Filter/i })).not.toBeInTheDocument();
  });

  it("selects package from dropdown menu and filters graph", () => {
    render(<MonorepoVisualizerPage />);

    const dropdown = screen.getByRole("combobox", { name: /Filter packages by workspace name/i });
    fireEvent.change(dropdown, { target: { value: "@atelier/auth-sdk" } });

    const searchInput = screen.getByPlaceholderText(/Filter packages by workspace name.../i);
    expect(searchInput).toHaveValue("@atelier/auth-sdk");

    const resetButton = screen.getByRole("button", { name: /Reset Filter/i });
    expect(resetButton).toBeInTheDocument();
  });
});
