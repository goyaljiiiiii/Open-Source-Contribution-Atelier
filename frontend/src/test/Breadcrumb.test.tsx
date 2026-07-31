import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { Breadcrumb, type BreadcrumbItem } from "../components/ui/Breadcrumb";

const renderBreadcrumb = (items: BreadcrumbItem[]) => {
  return render(
    <BrowserRouter>
      <Breadcrumb items={items} />
    </BrowserRouter>
  );
};

describe("Breadcrumb Navigation Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("returns null if items array is empty", () => {
    const { container } = renderBreadcrumb([]);
    expect(container.firstChild).toBeNull();
  });

  it("renders breadcrumb navigation items with proper links and labels", () => {
    const items: BreadcrumbItem[] = [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Pathway", href: "/pathway" },
      { label: "Git Foundations", href: "#" },
      { label: "Intro to Git", isCurrent: true },
    ];

    renderBreadcrumb(items);

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Pathway")).toBeInTheDocument();
    expect(screen.getByText("Git Foundations")).toBeInTheDocument();
    
    const currentItem = screen.getByText("Intro to Git");
    expect(currentItem).toBeInTheDocument();
    expect(currentItem).toHaveAttribute("aria-current", "page");
  });

  it("renders home icon for the first link item", () => {
    const items: BreadcrumbItem[] = [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Lesson 1", isCurrent: true },
    ];

    renderBreadcrumb(items);
    expect(screen.getByTestId("home-icon")).toBeInTheDocument();
  });

});
