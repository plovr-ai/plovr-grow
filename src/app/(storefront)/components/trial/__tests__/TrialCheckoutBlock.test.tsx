import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrialCheckoutBlock } from "../TrialCheckoutBlock";

vi.mock("../ClaimModal", () => ({
  ClaimModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="claim-modal">Modal</div> : null,
}));

describe("TrialCheckoutBlock", () => {
  it("should render the claim CTA", () => {
    render(<TrialCheckoutBlock tenantId="t1" />);
    expect(screen.getByText("Almost There!")).toBeInTheDocument();
    expect(screen.getByText("Claim This Website")).toBeInTheDocument();
  });

  it("should open ClaimModal when button is clicked", () => {
    render(<TrialCheckoutBlock tenantId="t1" />);
    expect(screen.queryByTestId("claim-modal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Claim This Website"));
    expect(screen.getByTestId("claim-modal")).toBeInTheDocument();
  });
});
