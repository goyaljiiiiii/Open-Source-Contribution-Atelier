import { render, screen, cleanup } from "@testing-library/react";
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

  it("changes event type using the event type dropdown selector", async () => {
    const user = userEvent.setup();
    render(<WebhookInspector />);

    const select = screen.getByRole("combobox", {
      name: "Select event type",
    });
    expect(select).toHaveValue("push");

    // Select PullRequestEvent
    await user.selectOptions(select, "pull_request");
    expect(select).toHaveValue("pull_request");
    expect(
      screen.getByText(
        /Triggered when a pull request is opened, closed, or synchronized/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("pull_request.json")).toBeInTheDocument();

    // Select IssuesEvent
    await user.selectOptions(select, "issues");
    expect(select).toHaveValue("issues");
    expect(
      screen.getByText(
        /Triggered when an issue is opened, edited, closed, or labeled/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("issues.json")).toBeInTheDocument();
  });

  it("allows switching event type using quick-select buttons", async () => {
    const user = userEvent.setup();
    render(<WebhookInspector />);

    const issuesButton = screen.getByRole("button", { name: /IssuesEvent/i });
    await user.click(issuesButton);

    expect(screen.getByText("issues.json")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("issues");
  });

  it("filters payload fields using search input", async () => {
    const user = userEvent.setup();
    render(<WebhookInspector />);

    const searchInput = screen.getByRole("textbox", {
      name: "Search within payload fields",
    });

    await user.type(searchInput, "pusher");

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

  it("toggles header validation section when Headers button is clicked", async () => {
    const user = userEvent.setup();
    render(<WebhookInspector />);

    // Initially headers section is displayed
    expect(screen.getByText("X-GitHub-Event")).toBeInTheDocument();
    expect(screen.getByText("X-Hub-Signature-256")).toBeInTheDocument();

    const headersToggleButton = screen.getByRole("button", { name: "Headers" });
    await user.click(headersToggleButton);

    // Headers toggled
    const headersToggleButton2 = screen.getByRole("button", { name: "Headers" });
    expect(headersToggleButton2).toHaveAttribute("aria-pressed", "false");
  });

  it("expands and collapses nodes when Expand All / Collapse All are clicked", async () => {
    const user = userEvent.setup();
    render(<WebhookInspector />);

    const collapseAllButton = screen.getByRole("button", {
      name: "Collapse all nodes",
    });
    await user.click(collapseAllButton);

    const expandAllButton = screen.getByRole("button", {
      name: "Expand all nodes",
    });
    await user.click(expandAllButton);

    expect(screen.getByText('"repository"')).toBeInTheDocument();
  });
});
