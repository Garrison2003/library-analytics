import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CirculationTrends from "./CirculationTrends";

describe("CirculationTrends Component", () => {
  it("renders the Juvenile Fiction chart title", () => {
    render(<CirculationTrends />);
    expect(screen.getByText("Juvenile Fiction")).toBeInTheDocument();
  });

  it("renders the Young Adult chart title", () => {
    render(<CirculationTrends />);
    expect(screen.getByText("Young Adult")).toBeInTheDocument();
  });

  it("renders two SVG charts", () => {
    const { container } = render(<CirculationTrends />);
    expect(container.querySelectorAll("svg")).toHaveLength(2);
  });

  it("renders 24 data point circles (12 per chart)", () => {
    const { container } = render(<CirculationTrends />);
    expect(container.querySelectorAll("circle")).toHaveLength(24);
  });

  it("renders month axis labels in each chart", () => {
    render(<CirculationTrends />);
    // Even-indexed months are labelled; "May 2025" is index 0, appears once per chart
    expect(screen.getAllByText("May 2025")).toHaveLength(2);
  });

  it("renders connecting lines between data points", () => {
    const { container } = render(<CirculationTrends />);
    // 11 lines per chart (between 12 points), 2 charts = 22 lines
    // Plus 2 axis lines per chart = 26 total <line> elements
    const lines = container.querySelectorAll("line");
    expect(lines.length).toBeGreaterThan(0);
  });
});
