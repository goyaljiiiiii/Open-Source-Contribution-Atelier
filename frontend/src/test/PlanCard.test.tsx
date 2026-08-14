import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PlanCard } from "../components/billing/PlanCard";

describe("PlanCard", () => {
  const dummyPlan = {
    id: 1,
    name: "Pro Plan",
    price: "19.99",
    stripe_price_id: "price_123",
    features: ["Unlimited Repos", "Priority Support"],
  };

  it("renders plan details and features list", () => {
    const { getByText } = render(
      <PlanCard
        plan={dummyPlan}
        onSubscribe={vi.fn()}
        isLoading={false}
        isCurrent={false}
        isLoggedIn={true}
      />
    );

    expect(getByText("Pro Plan")).toBeInTheDocument();
    expect(getByText("Unlimited Repos")).toBeInTheDocument();
  });

  it("renders safely without crashing when plan.features is null or undefined", () => {
    const planWithoutFeatures = {
      ...dummyPlan,
      name: "Fallback Plan",
      features: undefined as any,
    };

    const { getByText } = render(
      <PlanCard
        plan={planWithoutFeatures}
        onSubscribe={vi.fn()}
        isLoading={false}
        isCurrent={false}
        isLoggedIn={true}
      />
    );

    expect(getByText("Fallback Plan")).toBeInTheDocument();
  });
});
