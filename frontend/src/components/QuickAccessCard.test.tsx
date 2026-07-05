import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuickAccessCard from "./QuickAccessCard";

const defaultProps = {
  icon: <span>icon</span>,
  title: "Monthly View",
  description: "Analyze trends over months",
  color: "blue" as const,
  onClick: vi.fn(),
};

describe("QuickAccessCard Component", () => {
  it("renders the title", () => {
    render(<QuickAccessCard {...defaultProps} />);
    expect(screen.getByText("Monthly View")).toBeInTheDocument();
  });

  it("renders the description", () => {
    render(<QuickAccessCard {...defaultProps} />);
    expect(screen.getByText("Analyze trends over months")).toBeInTheDocument();
  });

  it("renders the icon", () => {
    render(<QuickAccessCard {...defaultProps} />);
    expect(screen.getByText("icon")).toBeInTheDocument();
  });

  it("renders as a button element", () => {
    render(<QuickAccessCard {...defaultProps} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<QuickAccessCard {...defaultProps} onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it.each(["blue", "green", "orange"] as const)(
    "renders without error for color '%s'",
    (color) => {
      const { container } = render(
        <QuickAccessCard {...defaultProps} color={color} />,
      );
      expect(container.firstChild).toBeInTheDocument();
    },
  );
});
