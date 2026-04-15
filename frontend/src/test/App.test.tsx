import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LandingPage } from "../pages/LandingPage";


describe("LandingPage", () => {
  it("renders the project headline", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/Teach contributors from first issue to advanced Git workflows/i),
    ).toBeInTheDocument();
  });
});
