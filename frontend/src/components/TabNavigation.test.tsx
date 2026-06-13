import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TabNavigation from "./TabNavigation";
import type { TabId } from "./TabNavigation";

describe("TabNavigation Component", () => {
  it("renders all five tab labels", () => {
    render(<TabNavigation activeTab="dashboard" onTabChange={vi.fn()} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Monthly View")).toBeInTheDocument();
    expect(screen.getByText("Daily View")).toBeInTheDocument();
    expect(screen.getByText("Programming")).toBeInTheDocument();
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

  it("calls onTabChange with 'programming' when Programming is clicked", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="dashboard" onTabChange={onTabChange} />);
    await user.click(screen.getByText("Programming"));
    expect(onTabChange).toHaveBeenCalledWith("programming" satisfies TabId);
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
    const indicators = container.querySelectorAll("span.bg-blue-600");
    expect(indicators).toHaveLength(1);
  });

  it("calls onTabChange even when clicking the already-active tab", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="dashboard" onTabChange={onTabChange} />);
    await user.click(screen.getByText("Dashboard"));
    expect(onTabChange).toHaveBeenCalledWith("dashboard" satisfies TabId);
  });

  it("shows active indicator under Dashboard when dashboard is active", () => {
    const { container } = render(
      <TabNavigation activeTab="dashboard" onTabChange={vi.fn()} />,
    );
    const indicator = container.querySelector("span.bg-blue-600");
    expect(indicator).toBeInTheDocument();
    // The indicator is inside the Dashboard button
    const dashboardBtn = screen.getByText("Dashboard").closest("button")!;
    expect(dashboardBtn.contains(indicator)).toBe(true);
  });

  it("shows active indicator under Programming when programming is active", () => {
    const { container } = render(
      <TabNavigation activeTab="programming" onTabChange={vi.fn()} />,
    );
    const indicator = container.querySelector("span.bg-blue-600");
    const programmingBtn = screen.getByText("Programming").closest("button")!;
    expect(programmingBtn.contains(indicator)).toBe(true);
  });

  it("shows active indicator under Upload when upload is active", () => {
    const { container } = render(
      <TabNavigation activeTab="upload" onTabChange={vi.fn()} />,
    );
    const indicator = container.querySelector("span.bg-blue-600");
    const uploadBtn = screen.getByText("Upload").closest("button")!;
    expect(uploadBtn.contains(indicator)).toBe(true);
  });

  it("renders exactly five buttons", () => {
    render(<TabNavigation activeTab="dashboard" onTabChange={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  it("only one indicator is visible at a time", () => {
    const { container, rerender } = render(
      <TabNavigation activeTab="dashboard" onTabChange={vi.fn()} />,
    );
    expect(container.querySelectorAll("span.bg-blue-600")).toHaveLength(1);
    rerender(<TabNavigation activeTab="upload" onTabChange={vi.fn()} />);
    expect(container.querySelectorAll("span.bg-blue-600")).toHaveLength(1);
  });
});
