import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Header from "./Header";

describe("Header Component", () => {
  it("renders the app title", () => {
    render(<Header onLogoClick={vi.fn()} />);
    expect(screen.getByText("Library Analytics")).toBeInTheDocument();
  });

  it("renders the tagline", () => {
    render(<Header onLogoClick={vi.fn()} />);
    expect(
      screen.getByText("Powerful Library Data Management & Analytics"),
    ).toBeInTheDocument();
  });

  it("calls onLogoClick when the logo button is clicked", async () => {
    const user = userEvent.setup();
    const onLogoClick = vi.fn();
    render(<Header onLogoClick={onLogoClick} />);
    await user.click(screen.getByRole("button", { name: /Library Analytics/i }));
    expect(onLogoClick).toHaveBeenCalledOnce();
  });

  it("renders the Dashboard navigation link", () => {
    render(<Header onLogoClick={vi.fn()} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders the Analytics navigation link", () => {
    render(<Header onLogoClick={vi.fn()} />);
    expect(screen.getByText("Analytics")).toBeInTheDocument();
  });

  it("renders the Settings navigation link", () => {
    render(<Header onLogoClick={vi.fn()} />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders a header element", () => {
    render(<Header onLogoClick={vi.fn()} />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });
});
