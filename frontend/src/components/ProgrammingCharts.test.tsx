import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ProgrammingCharts from "./ProgrammingCharts";

const MONTHS = [
  "07/24", "08/24", "09/24", "10/24", "11/24", "12/24",
  "01/25", "02/25", "03/25", "04/25", "05/25", "06/25",
  "07/25", "08/25", "09/25", "10/25", "11/25", "12/25",
];

const MOCK_RESPONSE = {
  success: true,
  data: {
    branch: "IMG",
    branchName: "Imaginon",
    months: MONTHS,
    attendance: MONTHS.map((_, i) => 1000 + i * 100),
    programs: MONTHS.map((_, i) => 50 + i * 5),
    dataFound: true,
    lastUpdated: "2025-12-01T00:00:00Z",
  },
};

describe("ProgrammingCharts Component", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "http://test.api");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => MOCK_RESPONSE }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("renders both chart titles", () => {
    render(<ProgrammingCharts />);
    expect(screen.getByText("In-Person Attendance")).toBeInTheDocument();
    expect(screen.getByText("Total Programs")).toBeInTheDocument();
  });

  it("renders two SVG charts", async () => {
    const { container } = render(<ProgrammingCharts selectedBranch="IMG" />);
    await waitFor(() =>
      expect(container.querySelectorAll("svg")).toHaveLength(2),
    );
  });

  it("renders fiscal year subtitle on each chart", () => {
    render(<ProgrammingCharts />);
    const subtitles = screen.getAllByText(/FY25\s*[–-]\s*FY26/);
    expect(subtitles).toHaveLength(2);
  });

  it("renders bar rectangles for each month", async () => {
    const { container } = render(<ProgrammingCharts selectedBranch="IMG" />);
    // 18 months × 2 charts = 36 bars
    await waitFor(() =>
      expect(container.querySelectorAll("rect")).toHaveLength(36),
    );
  });

  it("renders month labels starting from 07/24", async () => {
    render(<ProgrammingCharts selectedBranch="IMG" />);
    // "07/24" appears once per chart = 2 times
    await waitFor(() =>
      expect(screen.getAllByText("07/24")).toHaveLength(2),
    );
  });

  it("renders the last month label 12/25", async () => {
    render(<ProgrammingCharts selectedBranch="IMG" />);
    await waitFor(() =>
      expect(screen.getAllByText("12/25")).toHaveLength(2),
    );
  });
});
