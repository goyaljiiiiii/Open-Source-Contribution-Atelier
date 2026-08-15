import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { DataStateWrapper } from "../components/ui/DataStateWrapper";
import { ErrorStateCard } from "../components/ui/ErrorStateCard";

describe("DataStateWrapper Component", () => {
  it("renders loading indicator when loading is true", () => {
    render(
      <DataStateWrapper loading={true} loadingMessage="Loading test data...">
        <div>Data Loaded</div>
      </DataStateWrapper>
    );

    expect(screen.getByText("Loading test data...")).toBeInTheDocument();
    expect(screen.queryByText("Data Loaded")).not.toBeInTheDocument();
  });

  it("renders custom skeleton node when passed during loading", () => {
    render(
      <DataStateWrapper
        loading={true}
        skeleton={<div data-testid="custom-skeleton">Skeleton Loading...</div>}
      >
        <div>Data Loaded</div>
      </DataStateWrapper>
    );

    expect(screen.getByTestId("custom-skeleton")).toBeInTheDocument();
  });

  it("renders ErrorStateCard when error is provided", () => {
    render(
      <BrowserRouter>
        <DataStateWrapper
          loading={false}
          error="Network Connection Failed"
          errorTitle="API Connection Error"
        >
          <div>Data Loaded</div>
        </DataStateWrapper>
      </BrowserRouter>
    );

    expect(screen.getByText("API Connection Error")).toBeInTheDocument();
    expect(screen.getByText("Network Connection Failed")).toBeInTheDocument();
    expect(screen.queryByText("Data Loaded")).not.toBeInTheDocument();
  });

  it("triggers onRetry callback when Retry button is clicked on ErrorStateCard", () => {
    const handleRetry = vi.fn();

    render(
      <BrowserRouter>
        <ErrorStateCard
          title="Server Error"
          onRetry={handleRetry}
          retryLabel="Try Again Now"
        />
      </BrowserRouter>
    );

    const retryBtn = screen.getByText("Try Again Now");
    fireEvent.click(retryBtn);

    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it("renders EmptyStateCard when empty prop is true", () => {
    render(
      <DataStateWrapper
        loading={false}
        empty={true}
        emptyTitle="No Items Found"
        emptyDescription="Your search returned 0 items."
      >
        <div>Data Loaded</div>
      </DataStateWrapper>
    );

    expect(screen.getByText("No Items Found")).toBeInTheDocument();
    expect(screen.getByText("Your search returned 0 items.")).toBeInTheDocument();
    expect(screen.queryByText("Data Loaded")).not.toBeInTheDocument();
  });

  it("renders children when loading is false, no error, and not empty", () => {
    render(
      <DataStateWrapper loading={false}>
        <div data-testid="content">Actual Data Content</div>
      </DataStateWrapper>
    );

    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByText("Actual Data Content")).toBeInTheDocument();
  });
});
