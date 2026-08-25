import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserProfilePage } from "../pages/UserProfilePage";
import React from "react";
import * as apiModule from "../lib/api";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ username: "octocat" }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe("UserProfilePage Global Rank Percentile Badge Suite (#2817)", () => {
  beforeEach(() => {
    vi.useRealTimers();
    cleanup();

    vi.spyOn(apiModule, "fetchApi").mockImplementation((url: string) => {
      if (url.includes("/accounts/profile/")) {
        return Promise.resolve({
          user: {
            id: 1,
            username: "octocat",
            email: "octocat@github.com",
            is_staff: false,
            avatar_url: null,
            cover_image_url: null,
            timezone: "UTC",
            twitter_url: "https://twitter.com/octocat",
            linkedin_url: "https://linkedin.com/in/octocat",
            github_url: "https://github.com/octocat",
            bio: "Building open source software for everyone.",
          },
          badges: [
            {
              id: 1,
              earned_at: "2026-08-20T10:00:00Z",
              badge: {
                name: "First PR Merged",
                description: "Merged your first open source pull request.",
                icon_url: "",
                slug: "first-pr-merged",
              },
            },
          ],
          total_score: 1250,
          completed_lessons: 12,
          global_rank: 3,
          percentile_standing: 5,
          rank_tier: "Top 5%",
        });
      }
      return Promise.resolve({});
    });
  });

  it("renders global rank percentile standing badge under username", async () => {
    render(<UserProfilePage />);

    expect(await screen.findByText("octocat")).toBeInTheDocument();
    const badge = await screen.findByTestId("rank-percentile-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Top 5% Contributor");
  });

  it("displays global standing summary in statistics widget", async () => {
    render(<UserProfilePage />);

    expect(
      await screen.findByText("Statistics & Global Rank"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Global Standing: Top 5%"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Calculated against all active open source contributors"),
    ).toBeInTheDocument();
  });

  it("renders lessons completed and XP points in stats grid", async () => {
    render(<UserProfilePage />);

    expect(await screen.findByText("12")).toBeInTheDocument();
    expect(screen.getByText("1250")).toBeInTheDocument();
  });

  it("displays user bio and earned badges correctly", async () => {
    render(<UserProfilePage />);

    expect(
      await screen.findByText("Building open source software for everyone."),
    ).toBeInTheDocument();
    expect(screen.getByText("First PR Merged")).toBeInTheDocument();
  });

  it("renders social links for github, linkedin, and twitter", async () => {
    render(<UserProfilePage />);

    const githubLink = await screen.findByLabelText("GitHub Profile");
    expect(githubLink).toHaveAttribute("href", "https://github.com/octocat");

    const linkedinLink = screen.getByLabelText("LinkedIn Profile");
    expect(linkedinLink).toHaveAttribute("href", "https://linkedin.com/in/octocat");

    const twitterLink = screen.getByLabelText("Twitter Profile");
    expect(twitterLink).toHaveAttribute("href", "https://twitter.com/octocat");
  });

  it("supports copying profile URL link with confirmation feedback", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(<UserProfilePage />);

    const shareBtn = await screen.findByRole("button", { name: /Share Profile/i });
    expect(shareBtn).toBeInTheDocument();

    fireEvent.click(shareBtn);
    expect(await screen.findByText("Copied Link!")).toBeInTheDocument();
  });

  it("handles loading error gracefully by displaying fallback message", async () => {
    vi.spyOn(apiModule, "fetchApi").mockRejectedValueOnce(new Error("Profile unavailable"));

    render(<UserProfilePage />);

    expect(await screen.findByText("Profile Not Found")).toBeInTheDocument();
  });
});
