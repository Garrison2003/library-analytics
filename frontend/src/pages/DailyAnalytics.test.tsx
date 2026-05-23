import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DailyAnalytics from "./DailyAnalytics";

describe("DailyAnalytics Page", () => {
  it("renders the page heading", () => {
    render(<DailyAnalytics onBackHome={vi.fn()} />);
    expect(screen.getByText("Daily Analytics")).toBeInTheDocument();
  });

  it("renders the under construction message", () => {
    render(<DailyAnalytics onBackHome={vi.fn()} />);
    expect(
      screen.getByText("This page is under construction."),
    ).toBeInTheDocument();
  });

  it("renders the Back to Home button", () => {
    render(<DailyAnalytics onBackHome={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /Back to Home/i }),
    ).toBeInTheDocument();
  });

  it("calls onBackHome when Back to Home is clicked", async () => {
    const user = userEvent.setup();
    const onBackHome = vi.fn();
    render(<DailyAnalytics onBackHome={onBackHome} />);
    await user.click(screen.getByRole("button", { name: /Back to Home/i }));
    expect(onBackHome).toHaveBeenCalledOnce();
  });
});
