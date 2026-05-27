import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import CirculationTrends from "./CirculationTrends";

// ── Test data ─────────────────────────────────────────────────────────────────

const MONTHS = [
  "Jul 2025", "Aug 2025", "Sep 2025", "Oct 2025", "Nov 2025", "Dec 2025",
  "Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026",
];
const CATEGORIES = [
  "Juvenile Fiction", "Young Adult", "Adult", "Non-Print", "Total Circulation",
];

function makeApiData() {
  return CATEGORIES.flatMap((category) =>
    MONTHS.map((month, i) => ({
      category,
      month,
      year: i < 6 ? 2025 : 2026,
      circulation: 1000 + i * 100,
    })),
  );
}

function mockFetchOk(data = makeApiData()) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          data,
          branches: [],
          selectedBranch: "System",
          lastUpdated: "2026-01-01T00:00:00Z",
          totalRecords: data.length,
        },
      }),
    }),
  );
}

function mockFetchFail() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: false, status: 500 }),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CirculationTrends Component", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "http://test-api.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows loading skeleton initially", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    const { container } = render(<CirculationTrends />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders all five chart titles after data loads", async () => {
    mockFetchOk();
    render(<CirculationTrends />);
    await waitFor(() =>
      expect(screen.getByText("Juvenile Fiction")).toBeInTheDocument(),
    );
    expect(screen.getByText("Young Adult")).toBeInTheDocument();
    expect(screen.getByText("Adult")).toBeInTheDocument();
    expect(screen.getByText("Non-Print")).toBeInTheDocument();
    expect(screen.getByText("Total Circulation")).toBeInTheDocument();
  });

  it("renders five SVG charts after data loads", async () => {
    mockFetchOk();
    const { container } = render(<CirculationTrends />);
    await waitFor(() =>
      expect(container.querySelectorAll("svg")).toHaveLength(5),
    );
  });

  it("renders 60 data point circles (12 per chart × 5 charts)", async () => {
    mockFetchOk();
    const { container } = render(<CirculationTrends />);
    await waitFor(() =>
      expect(container.querySelectorAll("circle")).toHaveLength(60),
    );
  });

  it("renders month axis labels in each chart", async () => {
    mockFetchOk();
    render(<CirculationTrends />);
    // All months labeled; each appears once per chart (5 charts)
    await waitFor(() =>
      expect(screen.getAllByText("Jul 2025")).toHaveLength(5),
    );
    expect(screen.getAllByText("Jun 2026")).toHaveLength(5);
  });

  it("renders line paths connecting data points", async () => {
    mockFetchOk();
    const { container } = render(<CirculationTrends />);
    await waitFor(() => {
      const paths = container.querySelectorAll("path");
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  it("shows error state when API returns a failure status", async () => {
    mockFetchFail();
    render(<CirculationTrends />);
    await waitFor(() =>
      expect(
        screen.getByText("Failed to load circulation data"),
      ).toBeInTheDocument(),
    );
  });

  it("shows error state when VITE_API_URL is not configured", async () => {
    vi.unstubAllEnvs(); // clear the beforeEach stub
    vi.stubGlobal("fetch", vi.fn());
    render(<CirculationTrends />);
    await waitFor(() =>
      expect(
        screen.getByText("Failed to load circulation data"),
      ).toBeInTheDocument(),
    );
  });

  it("shows empty state when API returns no data points", async () => {
    mockFetchOk([]);
    render(<CirculationTrends />);
    await waitFor(() =>
      expect(screen.getByText("No data available")).toBeInTheDocument(),
    );
  });

  it("re-fetches when selectedBranch prop changes", async () => {
    mockFetchOk();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { data: makeApiData(), branches: ["Main"], selectedBranch: "Main", lastUpdated: "", totalRecords: 60 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<CirculationTrends selectedBranch="System" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    rerender(<CirculationTrends selectedBranch="Main Branch" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
