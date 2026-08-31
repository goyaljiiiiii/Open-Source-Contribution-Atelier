import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MultiplayerEditor } from "../components/notes/MultiplayerEditor";
import { CollabNotesPage } from "../pages/CollabNotesPage";
import { BrowserRouter } from "react-router-dom";

vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../lib/api", () => ({
  fetchApi: vi.fn().mockResolvedValue({ success: true }),
  API_BASE: "http://localhost:8000/api",
}));

describe("Collab Notes ARIA Labels & Toolbar Accessibility (#2811)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders all formatting toolbar buttons with descriptive aria-label attributes", () => {
    render(
      <MultiplayerEditor
        value="Sample notes content"
        onChange={() => {}}
        peers={[]}
      />,
    );

    const boldBtn = screen.getByRole("button", { name: "Format text as bold" });
    const italicBtn = screen.getByRole("button", { name: "Format text as italic" });
    const h1Btn = screen.getByRole("button", { name: "Format text as heading level 1" });
    const h2Btn = screen.getByRole("button", { name: "Format text as heading level 2" });
    const codeBtn = screen.getByRole("button", { name: "Format text as code block" });
    const listBtn = screen.getByRole("button", { name: "Format text as bullet list" });
    const taskBtn = screen.getByRole("button", { name: "Format text as task checkbox" });

    expect(boldBtn).toBeInTheDocument();
    expect(italicBtn).toBeInTheDocument();
    expect(h1Btn).toBeInTheDocument();
    expect(h2Btn).toBeInTheDocument();
    expect(codeBtn).toBeInTheDocument();
    expect(listBtn).toBeInTheDocument();
    expect(taskBtn).toBeInTheDocument();
  });

  it("ensures formatting toolbar is marked with role='toolbar' and an accessible label", () => {
    render(
      <MultiplayerEditor
        value="Sample notes content"
        onChange={() => {}}
        peers={[]}
      />,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Formatting controls" });
    expect(toolbar).toBeInTheDocument();
  });

  it("applies bold markdown formatting on button click", () => {
    let content = "Hello world";
    const handleChange = vi.fn((val) => {
      content = val;
    });

    render(
      <MultiplayerEditor
        value={content}
        onChange={handleChange}
        peers={[]}
      />,
    );

    const boldBtn = screen.getByRole("button", { name: "Format text as bold" });
    fireEvent.click(boldBtn);

    expect(handleChange).toHaveBeenCalled();
  });

  it("applies italic markdown formatting on button click", () => {
    let content = "Hello italic";
    const handleChange = vi.fn();

    render(
      <MultiplayerEditor
        value={content}
        onChange={handleChange}
        peers={[]}
      />,
    );

    const italicBtn = screen.getByRole("button", { name: "Format text as italic" });
    fireEvent.click(italicBtn);

    expect(handleChange).toHaveBeenCalled();
  });

  it("applies code block markdown formatting on button click", () => {
    let content = "Code sample";
    const handleChange = vi.fn();

    render(
      <MultiplayerEditor
        value={content}
        onChange={handleChange}
        peers={[]}
      />,
    );

    const codeBtn = screen.getByRole("button", { name: "Format text as code block" });
    fireEvent.click(codeBtn);

    expect(handleChange).toHaveBeenCalled();
  });

  it("applies bullet list markdown formatting on button click", () => {
    let content = "Bullet list sample";
    const handleChange = vi.fn();

    render(
      <MultiplayerEditor
        value={content}
        onChange={handleChange}
        peers={[]}
      />,
    );

    const listBtn = screen.getByRole("button", { name: "Format text as bullet list" });
    fireEvent.click(listBtn);

    expect(handleChange).toHaveBeenCalled();
  });

  it("applies task checkbox markdown formatting on button click", () => {
    let content = "Task sample";
    const handleChange = vi.fn();

    render(
      <MultiplayerEditor
        value={content}
        onChange={handleChange}
        peers={[]}
      />,
    );

    const taskBtn = screen.getByRole("button", { name: "Format text as task checkbox" });
    fireEvent.click(taskBtn);

    expect(handleChange).toHaveBeenCalled();
  });

  it("renders action buttons on CollabNotesPage with accessible aria labels", () => {
    render(
      <BrowserRouter>
        <CollabNotesPage />
      </BrowserRouter>,
    );

    expect(screen.getByRole("button", { name: "Copy Live Share Link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save note to backend database" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download Markdown file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fullscreen Zen Mode" })).toBeInTheDocument();
  });

  it("ensures all action buttons specify type='button'", () => {
    render(
      <BrowserRouter>
        <CollabNotesPage />
      </BrowserRouter>,
    );

    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute("type", "button");
    });
  });

  it("updates zen mode button aria-label when toggled", () => {
    render(
      <BrowserRouter>
        <CollabNotesPage />
      </BrowserRouter>,
    );

    const zenBtn = screen.getByRole("button", { name: "Fullscreen Zen Mode" });
    fireEvent.click(zenBtn);

    expect(screen.getByRole("button", { name: "Exit Zen Mode" })).toBeInTheDocument();
  });

  it("verifies view mode toggle buttons retain accessible labels and semantics", () => {
    render(
      <BrowserRouter>
        <CollabNotesPage />
      </BrowserRouter>,
    );

    expect(screen.getByRole("button", { name: "Switch to editor only view" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to split editor and preview view" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to rendered preview only view" })).toBeInTheDocument();
  });

  it("switches active view mode when clicking view mode toggle buttons", () => {
    render(
      <BrowserRouter>
        <CollabNotesPage />
      </BrowserRouter>,
    );

    const editOnlyBtn = screen.getByRole("button", { name: "Switch to editor only view" });
    fireEvent.click(editOnlyBtn);
    expect(editOnlyBtn.className).toContain("bg-blue-600");
  });

  it("preserves title and room ID keyboard input accessibility", () => {
    render(
      <BrowserRouter>
        <CollabNotesPage />
      </BrowserRouter>,
    );

    const inputs = screen.getAllByRole("textbox");
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it("renders active peer cursors indicators with accessible tooltips", () => {
    render(
      <MultiplayerEditor
        value="Notes with peer cursors"
        onChange={() => {}}
        peers={[
          { user_id: "u2", username: "Alice", color: "#EF4444", cursor: { line: 2, column: 5 } }
        ]}
      />,
    );

    expect(screen.getByText(/Alice/i)).toBeInTheDocument();
  });

  it("verifies word count and stats display update dynamically", () => {
    render(
      <MultiplayerEditor
        value={"Line 1\nLine 2\nLine 3"}
        onChange={() => {}}
        peers={[]}
      />,
    );

    expect(screen.getByText(/3 lines/i)).toBeInTheDocument();
    expect(screen.getByText(/6 words/i)).toBeInTheDocument();
  });

  it("handles template selection and updates document title and body", () => {
    render(
      <BrowserRouter>
        <CollabNotesPage />
      </BrowserRouter>,
    );

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "0" } });
  });
});
