import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Homepage from "./Homepage";

const defaultProps = {
  onMonthlyClick: vi.fn(),
  onDailyClick: vi.fn(),
  onUploadClick: vi.fn(),
};

describe("Homepage Component", () => {
  it("renders the hero welcome message", () => {
    render(<Homepage {...defaultProps} />);
    expect(
      screen.getByText("Welcome to Library Analytics"),
    ).toBeInTheDocument();
  });

  it("renders the hero subtitle", () => {
    render(<Homepage {...defaultProps} />);
    expect(
      screen.getByText(/Analyze your library's performance/i),
    ).toBeInTheDocument();
  });

  it("renders the Quick Access section heading", () => {
    render(<Homepage {...defaultProps} />);
    expect(screen.getByText("Quick Access")).toBeInTheDocument();
  });

  it("renders the Monthly View card", () => {
    render(<Homepage {...defaultProps} />);
    expect(screen.getByText("Monthly View")).toBeInTheDocument();
  });

  it("renders the Daily View card", () => {
    render(<Homepage {...defaultProps} />);
    expect(screen.getByText("Daily View")).toBeInTheDocument();
  });

  it("renders the Upload File card", () => {
    render(<Homepage {...defaultProps} />);
    expect(screen.getByText("Upload File")).toBeInTheDocument();
  });

  it("calls onMonthlyClick when Monthly View card is clicked", async () => {
    const user = userEvent.setup();
    const onMonthlyClick = vi.fn();
    render(<Homepage {...defaultProps} onMonthlyClick={onMonthlyClick} />);
    await user.click(screen.getByText("Monthly View").closest("button")!);
    expect(onMonthlyClick).toHaveBeenCalledOnce();
  });

  it("calls onDailyClick when Daily View card is clicked", async () => {
    const user = userEvent.setup();
    const onDailyClick = vi.fn();
    render(<Homepage {...defaultProps} onDailyClick={onDailyClick} />);
    await user.click(screen.getByText("Daily View").closest("button")!);
    expect(onDailyClick).toHaveBeenCalledOnce();
  });

  it("calls onUploadClick when Upload File card is clicked", async () => {
    const user = userEvent.setup();
    const onUploadClick = vi.fn();
    render(<Homepage {...defaultProps} onUploadClick={onUploadClick} />);
    await user.click(screen.getByText("Upload File").closest("button")!);
    expect(onUploadClick).toHaveBeenCalledOnce();
  });

  it("renders the At a Glance section heading", () => {
    render(<Homepage {...defaultProps} />);
    expect(screen.getByText("At a Glance")).toBeInTheDocument();
  });

  it("renders the Questions section heading", () => {
    render(<Homepage {...defaultProps} />);
    expect(screen.getByText("Questions")).toBeInTheDocument();
  });

  it("renders the questions input textarea", () => {
    render(<Homepage {...defaultProps} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});
