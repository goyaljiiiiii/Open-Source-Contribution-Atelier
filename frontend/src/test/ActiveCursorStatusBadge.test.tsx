import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  ActiveCursorStatusBadge,
  getCollaboratorColor,
} from "../components/editor/ActiveCursorStatusBadge";

describe("ActiveCursorStatusBadge", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders collaborator name and online status without cursor coordinates", () => {
    render(
      <ActiveCursorStatusBadge
        collaborator={{
          id: 1,
          name: "Alice",
        }}
      />,
    );

    const badge = screen.getByRole("status");
    expect(badge).toBeDefined();
    expect(badge.getAttribute("aria-label")).toContain("Collaborator Alice online");
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.queryByText(/Ln /)).toBeNull();
  });

  it("renders active cursor line and column coordinates when cursor is active", () => {
    render(
      <ActiveCursorStatusBadge
        collaborator={{
          id: 2,
          name: "Bob",
          cursor: { row: 4, col: 11 },
        }}
      />,
    );

    const badge = screen.getByRole("status");
    expect(badge.getAttribute("aria-label")).toContain("cursor at line 5, column 12");
    expect(screen.getByText("Bob")).toBeDefined();
    expect(screen.getByText("Ln 5, Col 12")).toBeDefined();
  });

  it("renders (You) suffix for current user", () => {
    render(
      <ActiveCursorStatusBadge
        collaborator={{
          id: 3,
          name: "Charlie",
          isSelf: true,
          cursor: { row: 0, col: 0 },
        }}
      />,
    );

    expect(screen.getByText("Charlie (You)")).toBeDefined();
    expect(screen.getByText("Ln 1, Col 1")).toBeDefined();
  });

  it("generates deterministic color from palette", () => {
    const color1 = getCollaboratorColor(1);
    const color2 = getCollaboratorColor(1);
    const color3 = getCollaboratorColor(2);

    expect(color1).toBe(color2);
    expect(typeof color1).toBe("string");
    expect(color1.startsWith("#")).toBe(true);
  });
});
