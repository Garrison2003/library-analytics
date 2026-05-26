import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CirculationTrends from "./CirculationTrends";

describe("CirculationTrends Component", () => {
  it("renders all five chart titles", () => {
    render(<CirculationTrends />);
    expect(screen.getByText("Juvenile Fiction")).toBeInTheDocument();
    expect(screen.getByText("Young Adult")).toBeInTheDocument();
    expect(screen.getByText("Adult")).toBeInTheDocument();
    expect(screen.getByText("Non-Print")).toBeInTheDocument();
    expect(screen.getByText("Total Circulation")).toBeInTheDocument();
  });

  it("renders five SVG charts", () => {
    const { container } = render(<CirculationTrends />);
    expect(container.querySelectorAll("svg")).toHaveLength(5);
  });

  it("renders 60 data point circles (12 per chart × 5 charts)", () => {
    const { container } = render(<CirculationTrends />);
    expect(container.querySelectorAll("circle")).toHaveLength(60);
  });

  it("renders month axis labels in each chart", () => {
    render(<CirculationTrends />);
    // Every 3rd index is labelled (indices 0, 3, 6, 9); each label appears once per chart (5 charts)
    expect(screen.getAllByText("May 2025")).toHaveLength(5);
    expect(screen.getAllByText("Aug 2025")).toHaveLength(5);
    expect(screen.getAllByText("Nov 2025")).toHaveLength(5);
    expect(screen.getAllByText("Feb 2026")).toHaveLength(5);
  });

  it("renders connecting lines between data points", () => {
    const { container } = render(<CirculationTrends />);
    const lines = container.querySelectorAll("line");
    expect(lines.length).toBeGreaterThan(0);
  });
});
