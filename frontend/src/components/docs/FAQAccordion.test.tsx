import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FAQAccordion } from "./FAQAccordion";

describe("FAQAccordion", () => {
  it("filters FAQs by category and search text", async () => {
    const user = userEvent.setup();
    render(<FAQAccordion />);

    expect(screen.getByText("How do I set up the project locally?")).toBeInTheDocument();
    expect(screen.getByText("What should I check before deploying a docs change?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Certificates" }));
    expect(screen.queryByText("How do I set up the project locally?")).not.toBeInTheDocument();
    expect(screen.getByText("How are certificates generated and verified?")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search FAQs" }), "badges");

    expect(screen.getByText("What is the relationship between certificates and badges?")).toBeInTheDocument();
    expect(screen.queryByText("How are certificates generated and verified?")).not.toBeInTheDocument();
  });
});