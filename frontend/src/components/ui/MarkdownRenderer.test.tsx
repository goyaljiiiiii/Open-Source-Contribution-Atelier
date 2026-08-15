import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownRenderer } from "./MarkdownRenderer";

describe("MarkdownRenderer Table Parsing", () => {
  it("renders markdown table with pipes inside code spans correctly", () => {
    const markdown = `
| Command | Description |
|---|---|
| \`git Log --oneline | grep feat\` | Filter logs by feat |
`;

    render(
      <MarkdownRenderer
        content={markdown}
        loadGlossaryFn={async () => []}
      />,
    );

    expect(screen.getByText("Command")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("git Log --oneline | grep feat")).toBeInTheDocument();
    expect(screen.getByText("Filter logs by feat")).toBeInTheDocument();
  });
});
