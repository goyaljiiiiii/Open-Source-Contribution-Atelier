import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { WebhookInspector } from "../components/docs/WebhookInspector";

describe("WebhookInspector", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the main heading and default event payload (PushEvent)", () => {
    render(<WebhookInspector />);

    expect(
      screen.getByRole("heading", { name: "Webhook Event Payload Inspector" }),
    ).toBeInTheDocument();

    expect(screen.getByText("push.json")).toBeInTheDocument();
    expect(
      screen.getByText(/Triggered when a push is made to a repository branch/),
    ).toBeInTheDocument();
  });

  it("changes event type using the event type dropdown selector", () => {
    render(<WebhookInspector />);

    const select = screen.getByRole("combobox", {
      name: "Select event type",
    });
    expect(select).toHaveValue("push");

    // Select PullRequestEvent
    fireEvent.change(select, { target: { value: "pull_request" } });
    expect(select).toHaveValue("pull_request");
    expect(
      screen.getByText(
        /Triggered when a pull request is opened, closed, or synchronized/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("pull_request.json")).toBeInTheDocument();

    // Select IssuesEvent
    fireEvent.change(select, { target: { value: "issues" } });
    expect(select).toHaveValue("issues");
    expect(
      screen.getByText(
        /Triggered when an issue is opened, edited, closed, or labeled/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("issues.json")).toBeInTheDocument();

    // Select StarEvent
    fireEvent.change(select, { target: { value: "star" } });
    expect(select).toHaveValue("star");
    expect(
      screen.getByText(/Triggered when a repository is starred or unstarred/),
    ).toBeInTheDocument();
    expect(screen.getByText("star.json")).toBeInTheDocument();
  });

  it("allows switching event type using quick-select buttons", () => {
    render(<WebhookInspector />);

    const issuesButton = screen.getByRole("button", { name: /IssuesEvent/i });
    fireEvent.click(issuesButton);

    expect(screen.getByText("issues.json")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("issues");
  });

  it("filters payload fields using search input", () => {
    render(<WebhookInspector />);

    const searchInput = screen.getByRole("textbox", {
      name: "Search within payload fields",
    });

    fireEvent.change(searchInput, { target: { value: "pusher" } });

    expect(searchInput).toHaveValue("pusher");
    expect(screen.getByText('"pusher"')).toBeInTheDocument();
  });

  it("copies sample payload to clipboard when copy button is clicked", async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    render(<WebhookInspector />);

    const copyButton = screen.getByRole("button", {
      name: /Copy sample payload to clipboard/i,
    });
    await user.click(copyButton);

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock.mock.calls[0][0]).toContain("refs/heads/main");
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("toggles header validation section when Headers button is clicked", () => {
    render(<WebhookInspector />);

    // Initially headers section is displayed
    expect(screen.getByText("X-GitHub-Event")).toBeInTheDocument();
    expect(screen.getByText("X-Hub-Signature-256")).toBeInTheDocument();

    const headersToggleButton = screen.getByRole("button", { name: "Headers" });
    fireEvent.click(headersToggleButton);

    // Headers toggled
    const headersToggleButton2 = screen.getByRole("button", { name: "Headers" });
    expect(headersToggleButton2).toHaveAttribute("aria-pressed", "false");
  });

  it("expands and collapses nodes when Expand All / Collapse All are clicked", () => {
    render(<WebhookInspector />);

    const collapseAllButton = screen.getByRole("button", {
      name: "Collapse all nodes",
    });
    fireEvent.click(collapseAllButton);

    const expandAllButton = screen.getByRole("button", {
      name: "Expand all nodes",
    });
    fireEvent.click(expandAllButton);

    expect(screen.getByText('"repository"')).toBeInTheDocument();
  });
});
