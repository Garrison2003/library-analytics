import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MonthlyAnalytics from "./MonthlyAnalytics";

const BRANCHES = ["Main", "West Branch"];

function makeTimeSeriesData() {
  return {
    department: "Main",
    fyLabels: ["FY2025", "FY2026"],
    monthLabels: [
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    ],
    latestFy: "FY2026",
    lastActualIndex: 1,
    hasForecast: true,
    series: {
      overlay: {
        FY2025: [{ month: "Jul", total: 1000, forecast: false }],
        FY2026: [
          { month: "Jul", total: 1100, forecast: false },
          { month: "Aug", total: 1150, forecast: true, seLow: 1000, seHigh: 1300 },
        ],
      },
      annual: [
        { fy: "FY2025", print: 8000, nonprint: 2000, forecastPrint: 0, forecastNonprint: 0 },
        { fy: "FY2026", print: 4000, nonprint: 1000, forecastPrint: 500, forecastNonprint: 100 },
      ],
      timeline: [
        { index: 0, fy: "FY2025", month: "Jul", total: 1000, forecast: false },
        { index: 12, fy: "FY2026", month: "Jul", total: 1100, forecast: false },
      ],
      yoy: {
        FY2026: [{ month: "Jul", pctChange: 10, forecast: false }],
      },
    },
  };
}

function mockFetchOk() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/circulation")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              data: [],
              branches: BRANCHES,
              selectedBranch: "",
              lastUpdated: "2026-01-01T00:00:00Z",
              totalRecords: 0,
            },
          }),
        };
      }
      if (url.includes("/timeseries")) {
        return {
          ok: true,
          json: async () => ({ success: true, data: makeTimeSeriesData() }),
        };
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    }),
  );
}

function mockFetchPending() {
  vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MonthlyAnalytics Page", () => {
  it("renders the page heading", () => {
    mockFetchPending();
    render(<MonthlyAnalytics onBackHome={vi.fn()} />);
    expect(screen.getByText("Monthly Analytics")).toBeInTheDocument();
  });

  it("renders the Back to Home button", () => {
    mockFetchPending();
    render(<MonthlyAnalytics onBackHome={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /Back to Home/i }),
    ).toBeInTheDocument();
  });

  it("calls onBackHome when Back to Home is clicked", async () => {
    mockFetchPending();
    const user = userEvent.setup();
    const onBackHome = vi.fn();
    render(<MonthlyAnalytics onBackHome={onBackHome} />);
    await user.click(screen.getByRole("button", { name: /Back to Home/i }));
    expect(onBackHome).toHaveBeenCalledOnce();
  });

  it("shows a loading skeleton while branches and series are fetched", () => {
    mockFetchPending();
    const { container } = render(<MonthlyAnalytics onBackHome={vi.fn()} />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders all four charts and the summary cards once data loads", async () => {
    mockFetchOk();
    render(<MonthlyAnalytics onBackHome={vi.fn()} />);
    await waitFor(() =>
      expect(
        screen.getByText("Total Circulation by Fiscal Year"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Annual Print vs Non-Print Totals")).toBeInTheDocument();
    expect(screen.getByText(/Full Chronological Timeline/)).toBeInTheDocument();
    expect(screen.getByText("Year-over-Year % Change by Month")).toBeInTheDocument();
    expect(screen.getByText(/Latest Reported Month/)).toBeInTheDocument();
  });

  it("shows an error state when the time series request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/circulation")) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                data: [],
                branches: BRANCHES,
                selectedBranch: "",
                lastUpdated: "2026-01-01T00:00:00Z",
                totalRecords: 0,
              },
            }),
          };
        }
        return { ok: false, status: 500, statusText: "Internal Server Error" };
      }),
    );
    render(<MonthlyAnalytics onBackHome={vi.fn()} />);
    await waitFor(() =>
      expect(
        screen.getByText("Failed to load time series data"),
      ).toBeInTheDocument(),
    );
  });
});
