import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TabNavigation from "./TabNavigation";
import type { TabId } from "./TabNavigation";

describe("TabNavigation Component", () => {
  it("renders all four tab labels", () => {
    render(<TabNavigation activeTab="dashboard" onTabChange={vi.fn()} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Monthly View")).toBeInTheDocument();
    expect(screen.getByText("Daily View")).toBeInTheDocument();
    expect(screen.getByText("Upload")).toBeInTheDocument();
  });

  it("calls onTabChange with correct id when a tab is clicked", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="dashboard" onTabChange={onTabChange} />);
    await user.click(screen.getByText("Monthly View"));
    expect(onTabChange).toHaveBeenCalledWith("monthly" satisfies TabId);
  });

  it("calls onTabChange with 'daily' when Daily View is clicked", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="dashboard" onTabChange={onTabChange} />);
    await user.click(screen.getByText("Daily View"));
    expect(onTabChange).toHaveBeenCalledWith("daily" satisfies TabId);
  });

  it("calls onTabChange with 'upload' when Upload is clicked", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="dashboard" onTabChange={onTabChange} />);
    await user.click(screen.getByText("Upload"));
    expect(onTabChange).toHaveBeenCalledWith("upload" satisfies TabId);
  });

  it("renders the active indicator for the active tab", () => {
    const { container } = render(
      <TabNavigation activeTab="monthly" onTabChange={vi.fn()} />,
    );
    // The active indicator span is only rendered for the active tab
    const indicators = container.querySelectorAll("span.bg-blue-600");
    expect(indicators).toHaveLength(1);
  });
});
