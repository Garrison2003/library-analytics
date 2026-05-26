import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProgrammingCharts from "./ProgrammingCharts";

describe("ProgrammingCharts Component", () => {
  it("renders both chart titles", () => {
    render(<ProgrammingCharts />);
    expect(screen.getByText("In-Person Attendance")).toBeInTheDocument();
    expect(screen.getByText("Total Programs")).toBeInTheDocument();
  });

  it("renders two SVG charts", () => {
    const { container } = render(<ProgrammingCharts />);
    expect(container.querySelectorAll("svg")).toHaveLength(2);
  });

  it("renders fiscal year subtitle on each chart", () => {
    render(<ProgrammingCharts />);
    const subtitles = screen.getAllByText(/FY25\s*[–-]\s*FY26/);
    expect(subtitles).toHaveLength(2);
  });

  it("renders bar rectangles for each month", () => {
    const { container } = render(<ProgrammingCharts />);
    // 18 months × 2 charts = 36 bars
    const bars = container.querySelectorAll("rect");
    expect(bars).toHaveLength(36);
  });

  it("renders month labels starting from 07/24", () => {
    render(<ProgrammingCharts />);
    // "07/24" appears once per chart = 2 times
    expect(screen.getAllByText("07/24")).toHaveLength(2);
  });

  it("renders the last month label 12/25", () => {
    render(<ProgrammingCharts />);
    expect(screen.getAllByText("12/25")).toHaveLength(2);
  });
});
