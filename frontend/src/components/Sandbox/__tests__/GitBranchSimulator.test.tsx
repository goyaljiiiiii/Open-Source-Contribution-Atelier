import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { GitBranchSimulator } from "../GitBranchSimulator";

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe("GitBranchSimulator", () => {
  it("renders the header with title and XP counter", () => {
    renderWithRouter(<GitBranchSimulator />);
    expect(screen.getByText(/Git Branch Workflow Simulator/)).toBeInTheDocument();
    expect(screen.getByText("0 XP")).toBeInTheDocument();
  });

  it("renders the terminal with initial logs", () => {
    renderWithRouter(<GitBranchSimulator />);
    expect(screen.getByText(/Git Branch Workflow Simulator v1.0/)).toBeInTheDocument();
    expect(screen.getByText(/Type 'help' for available commands/)).toBeInTheDocument();
  });

  it("renders the branch graph", () => {
    renderWithRouter(<GitBranchSimulator />);
    expect(screen.getByText("Branch Graph")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("renders exercises panel with all exercises", () => {
    renderWithRouter(<GitBranchSimulator />);
    expect(screen.getByText("Exercises")).toBeInTheDocument();
    expect(screen.getByText("Create a Feature Branch")).toBeInTheDocument();
    expect(screen.getByText("0/10")).toBeInTheDocument();
  });

  it("shows help when typing help command", () => {
    renderWithRouter(<GitBranchSimulator />);
    const input = screen.getByPlaceholderText(/Type a git command/);
    fireEvent.change(input, { target: { value: "help" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByText(/Available Branch Workflow Commands/)).toBeInTheDocument();
  });

  it("creates a new branch with checkout -b", () => {
    renderWithRouter(<GitBranchSimulator />);
    const input = screen.getByPlaceholderText(/Type a git command/);
    fireEvent.change(input, { target: { value: "git checkout -b feature/auth" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByText(/Switched to a new branch 'feature\/auth'/)).toBeInTheDocument();
  });

  it("lists branches with git branch", () => {
    renderWithRouter(<GitBranchSimulator />);
    const input = screen.getByPlaceholderText(/Type a git command/);
    fireEvent.change(input, { target: { value: "git branch" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByText("Branches:")).toBeInTheDocument();
  });

  it("resets the simulator", () => {
    renderWithRouter(<GitBranchSimulator />);
    const input = screen.getByPlaceholderText(/Type a git command/);
    fireEvent.change(input, { target: { value: "reset" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByText(/Simulator reset to initial state/)).toBeInTheDocument();
  });

  it("shows error for unknown command", () => {
    renderWithRouter(<GitBranchSimulator />);
    const input = screen.getByPlaceholderText(/Type a git command/);
    fireEvent.change(input, { target: { value: "unknown-cmd" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByText(/Command not recognized/)).toBeInTheDocument();
  });

  it("shows git status correctly", () => {
    renderWithRouter(<GitBranchSimulator />);
    const input = screen.getByPlaceholderText(/Type a git command/);
    fireEvent.change(input, { target: { value: "git status" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByText("On branch main")).toBeInTheDocument();
  });

  it("handles git log", () => {
    renderWithRouter(<GitBranchSimulator />);
    const input = screen.getByPlaceholderText(/Type a git command/);
    fireEvent.change(input, { target: { value: "git log" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByText(/commit c3/)).toBeInTheDocument();
    expect(screen.getByText(/Create basic project structure/)).toBeInTheDocument();
  });

  it("handles git commit with no message flag", () => {
    renderWithRouter(<GitBranchSimulator />);
    const input = screen.getByPlaceholderText(/Type a git command/);
    fireEvent.change(input, { target: { value: "git commit" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByText(/usage: git commit -m/)).toBeInTheDocument();
  });

  it("handles git stash and stash pop", () => {
    renderWithRouter(<GitBranchSimulator />);
    const input = screen.getByPlaceholderText(/Type a git command/);

    fireEvent.change(input, { target: { value: "git stash" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByText(/Saved working directory changes/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "git stash pop" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByText(/Changes restored from stash/)).toBeInTheDocument();
  });
});
