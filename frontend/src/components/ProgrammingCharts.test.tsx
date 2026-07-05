import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ProgrammingCharts from "./ProgrammingCharts";

vi.mock("../services/api", () => ({
  apiClient: {
    getProgrammingData: vi.fn(),
  },
}));

import { apiClient } from "../services/api";

// Months as returned by programmingHistoryAPI (YYYY-MM format from DynamoDB)
const YEAR_MONTHS = [
  "2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12",
  "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
];

const MOCK_RESPONSE = {
  success: true,
  timestamp: new Date("2025-06-01T00:00:00Z"),
  requestId: "req_test",
  data: {
    branch: "SPA",
    branchName: "Spangler",
    months: YEAR_MONTHS,
    attendance: YEAR_MONTHS.map((_, i) => 1000 + i * 100),
    programs: YEAR_MONTHS.map((_, i) => 50 + i * 5),
    dataFound: true,
    lastUpdated: "2025-06-01T00:00:00Z",
  },
};

describe("ProgrammingCharts Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.getProgrammingData).mockResolvedValue(MOCK_RESPONSE);
  });

  it("renders both chart titles", () => {
    render(<ProgrammingCharts />);
    expect(screen.getByText("In-Person Attendance")).toBeInTheDocument();
    expect(screen.getByText("Total Programs")).toBeInTheDocument();
  });

  it("renders fiscal year subtitle on each chart", () => {
    render(<ProgrammingCharts />);
    const subtitles = screen.getAllByText(/FY\d{2}\s*[–-]\s*FY\d{2}/);
    expect(subtitles).toHaveLength(2);
  });

  it("renders two SVG charts after data loads", async () => {
    const { container } = render(<ProgrammingCharts selectedBranch="Spangler" />);
    await waitFor(() =>
      expect(container.querySelectorAll("svg")).toHaveLength(2),
    );
  });

  it("renders one bar per month per chart", async () => {
    const { container } = render(<ProgrammingCharts selectedBranch="Spangler" />);
    // 12 months × 2 charts = 24 bars
    await waitFor(() =>
      expect(container.querySelectorAll("rect")).toHaveLength(YEAR_MONTHS.length * 2),
    );
  });

  it("calls apiClient.getProgrammingData with the branch code", async () => {
    render(<ProgrammingCharts selectedBranch="Spangler" />);
    await waitFor(() =>
      expect(apiClient.getProgrammingData).toHaveBeenCalledWith("SPA"),
    );
  });

  it("formats YYYY-MM month labels for display", async () => {
    render(<ProgrammingCharts selectedBranch="Spangler" />);
    // "2024-07" → "Jul 24"; expect it to appear on both charts
    await waitFor(() => {
      const labels = screen.getAllByText(/Jul.+24/);
      expect(labels.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("does not call the API when no branch is selected", () => {
    render(<ProgrammingCharts />);
    expect(apiClient.getProgrammingData).not.toHaveBeenCalled();
  });

  it("does not call the API for a branch not in the code map", () => {
    render(<ProgrammingCharts selectedBranch="Unknown Branch XYZ" />);
    expect(apiClient.getProgrammingData).not.toHaveBeenCalled();
  });

  it("shows no-data message when dataFound is false", async () => {
    vi.mocked(apiClient.getProgrammingData).mockResolvedValueOnce({
      success: true,
      timestamp: new Date("2025-06-01T00:00:00Z"),
      requestId: "req_test",
      data: { ...MOCK_RESPONSE.data, dataFound: false, months: [], attendance: [], programs: [] },
    });
    render(<ProgrammingCharts selectedBranch="Spangler" />);
    await waitFor(() =>
      expect(screen.getAllByText(/no current data/i).length).toBeGreaterThan(0),
    );
  });

  it("displays months chronologically with the earliest on the left", async () => {
    // Real API returns months newest-first; component should reverse them for display.
    const newestFirst = [...YEAR_MONTHS].reverse(); // "2025-06", …, "2024-07"
    vi.mocked(apiClient.getProgrammingData).mockResolvedValueOnce({
      ...MOCK_RESPONSE,
      data: {
        ...MOCK_RESPONSE.data,
        months: newestFirst,
        attendance: newestFirst.map((_, i) => 100 * (i + 1)),
        programs: newestFirst.map((_, i) => 10 * (i + 1)),
      },
    });

    const { container } = render(<ProgrammingCharts selectedBranch="Spangler" />);

    await waitFor(() => {
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
      const texts = Array.from(svgs[0].querySelectorAll("text"));
      const monthLabels = texts
        .map((t) => t.textContent || "")
        .filter((t) => /^[A-Z][a-z]{2}\s+\d{2}$/.test(t));
      expect(monthLabels.length).toBeGreaterThan(0);
      // After reversal: Jul 24 (oldest) on the left, Jun 25 (newest) on the right
      expect(monthLabels[0]).toMatch(/Jul.+24/);
      expect(monthLabels[monthLabels.length - 1]).toMatch(/Jun.+25/);
    });
  });

  it("does not throw when months field is absent (dataFound: false response)", async () => {
    vi.mocked(apiClient.getProgrammingData).mockResolvedValueOnce({
      success: true,
      timestamp: new Date("2025-06-01T00:00:00Z"),
      requestId: "req_test",
      data: { branch: "SPA", branchName: "Spangler", dataFound: false },
    });
    // Should render without crashing — no "Failed to load" error
    render(<ProgrammingCharts selectedBranch="Spangler" />);
    await waitFor(() =>
      expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument(),
    );
  });
});
