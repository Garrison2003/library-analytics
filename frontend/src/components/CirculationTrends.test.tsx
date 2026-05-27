import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import CirculationTrends from "./CirculationTrends";

// ── Test data ─────────────────────────────────────────────────────────────────

const MONTHS = [
  "Jul 2025",
  "Aug 2025",
  "Sep 2025",
  "Oct 2025",
  "Nov 2025",
  "Dec 2025",
  "Jan 2026",
  "Feb 2026",
  "Mar 2026",
  "Apr 2026",
  "May 2026",
  "Jun 2026",
];
const CATEGORIES = [
  "Juvenile",
  "Young Adult",
  "Adult",
  "Non-Print",
  "Total Circulation",
];

/** Breakdown maps per category, mirroring the real spreadsheet columns. */
const BREAKDOWN_MAP: Record<string, (base: number) => Record<string, number>> =
  {
    Juvenile: (b) => ({
      "Juvenile Fiction": Math.round(b * 0.84),
      "Juvenile Non-Fiction": Math.round(b * 0.16),
    }),
    "Young Adult": (b) => ({
      "Young Adult Fiction": Math.round(b * 0.91),
      "Young Adult Non-Fiction": Math.round(b * 0.09),
    }),
    Adult: (b) => ({
      "Adult Fiction": Math.round(b * 0.61),
      "Adult Non-Fiction": Math.round(b * 0.39),
    }),
    "Non-Print": (b) => ({
      Audio: Math.round(b * 0.82),
      Visual: Math.round(b * 0.18),
    }),
    "Total Circulation": (b) => ({
      "Total Books": Math.round(b * 0.8),
      "Total NonPrint": Math.round(b * 0.2),
    }),
  };

function makeApiData(opts?: { withBreakdown?: boolean }) {
  return CATEGORIES.flatMap((category) =>
    MONTHS.map((month, i) => {
      const circulation = 1000 + i * 100;
      const base: any = {
        category,
        month,
        year: i < 6 ? 2025 : 2026,
        circulation,
      };
      if (opts?.withBreakdown && BREAKDOWN_MAP[category]) {
        base.breakdown = BREAKDOWN_MAP[category](circulation);
      }
      return base;
    }),
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
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
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
      expect(screen.getByText("Juvenile")).toBeInTheDocument(),
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

  it("renders 60 visible data-point circles (12 per chart × 5 charts)", async () => {
    mockFetchOk();
    const { container } = render(<CirculationTrends />);
    await waitFor(() => {
      const circles = container.querySelectorAll("circle[stroke='white']");
      expect(circles).toHaveLength(60);
    });
  });

  it("renders month axis labels in each chart", async () => {
    mockFetchOk();
    render(<CirculationTrends />);
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
    vi.unstubAllEnvs();
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
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          data: makeApiData(),
          branches: ["Main"],
          selectedBranch: "Main",
          lastUpdated: "",
          totalRecords: 60,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<CirculationTrends selectedBranch="System" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    rerender(<CirculationTrends selectedBranch="Main Branch" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  // ── Y-axis label tests ──────────────────────────────────────────────────

  it("renders dynamic y-axis labels in each chart", async () => {
    mockFetchOk();
    const { container } = render(<CirculationTrends />);
    await waitFor(() => {
      const yLabels = container.querySelectorAll(
        '[data-testid="y-axis-label"]',
      );
      expect(yLabels.length).toBeGreaterThanOrEqual(5);
    });
  });

  it("y-axis labels use K suffix for large values", async () => {
    const bigData = CATEGORIES.flatMap((category) =>
      MONTHS.map((month, i) => ({
        category,
        month,
        year: i < 6 ? 2025 : 2026,
        circulation: 40000 + i * 5000,
      })),
    );
    mockFetchOk(bigData);
    const { container } = render(<CirculationTrends />);
    await waitFor(() => {
      const yLabels = container.querySelectorAll(
        '[data-testid="y-axis-label"]',
      );
      const texts = Array.from(yLabels).map((el) => el.textContent);
      expect(texts.some((t) => t?.includes("K"))).toBe(true);
    });
  });

  // ── Hover tooltip tests ─────────────────────────────────────────────────

  it("shows tooltip on data point hover (no breakdown)", async () => {
    mockFetchOk();
    const { container } = render(<CirculationTrends />);
    await waitFor(() => {
      expect(container.querySelectorAll("circle[stroke='white']")).toHaveLength(
        60,
      );
    });

    const firstGroup = container.querySelectorAll("circle[stroke='white']")[0]
      .parentElement!;
    fireEvent.mouseEnter(firstGroup);

    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="circulation-tooltip"]'),
      ).toBeInTheDocument();
    });
  });

  it("hides tooltip when mouse leaves a data point", async () => {
    mockFetchOk();
    const { container } = render(<CirculationTrends />);
    await waitFor(() => {
      expect(container.querySelectorAll("circle[stroke='white']")).toHaveLength(
        60,
      );
    });

    const firstGroup = container.querySelectorAll("circle[stroke='white']")[0]
      .parentElement!;

    fireEvent.mouseEnter(firstGroup);
    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="circulation-tooltip"]'),
      ).toBeInTheDocument();
    });

    fireEvent.mouseLeave(firstGroup);
    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="circulation-tooltip"]'),
      ).not.toBeInTheDocument();
    });
  });

  it("shows Juvenile Fiction / Non-Fiction breakdown in Juvenile tooltip", async () => {
    mockFetchOk(makeApiData({ withBreakdown: true }));
    const { container } = render(<CirculationTrends />);
    await waitFor(() => {
      expect(container.querySelectorAll("circle[stroke='white']")).toHaveLength(
        60,
      );
    });

    // First chart is Juvenile — hover on its first data point
    const firstGroup = container.querySelectorAll("circle[stroke='white']")[0]
      .parentElement!;
    fireEvent.mouseEnter(firstGroup);

    await waitFor(() => {
      const tooltip = container.querySelector(
        '[data-testid="circulation-tooltip"]',
      );
      expect(tooltip).toBeInTheDocument();
      const text = tooltip!.textContent;
      expect(text).toContain("Juvenile Fiction");
      expect(text).toContain("Juvenile Non-Fiction");
      expect(text).toContain("Total");
    });
  });

  it("shows Audio / Visual breakdown in Non-Print tooltip", async () => {
    mockFetchOk(makeApiData({ withBreakdown: true }));
    const { container } = render(<CirculationTrends />);
    await waitFor(() => {
      expect(container.querySelectorAll("circle[stroke='white']")).toHaveLength(
        60,
      );
    });

    // Non-Print is the 4th chart (indices 36-47 are its circles)
    const nonPrintFirstGroup = container.querySelectorAll(
      "circle[stroke='white']",
    )[36].parentElement!;
    fireEvent.mouseEnter(nonPrintFirstGroup);

    await waitFor(() => {
      const tooltip = container.querySelector(
        '[data-testid="circulation-tooltip"]',
      );
      expect(tooltip).toBeInTheDocument();
      const text = tooltip!.textContent;
      expect(text).toContain("Audio");
      expect(text).toContain("Visual");
      expect(text).toContain("Total");
    });
  });

  it("shows Total Books / Total NonPrint breakdown in Total Circulation tooltip", async () => {
    mockFetchOk(makeApiData({ withBreakdown: true }));
    const { container } = render(<CirculationTrends />);
    await waitFor(() => {
      expect(container.querySelectorAll("circle[stroke='white']")).toHaveLength(
        60,
      );
    });

    // Total Circulation is the 5th chart (indices 48-59)
    const totalFirstGroup = container.querySelectorAll(
      "circle[stroke='white']",
    )[48].parentElement!;
    fireEvent.mouseEnter(totalFirstGroup);

    await waitFor(() => {
      const tooltip = container.querySelector(
        '[data-testid="circulation-tooltip"]',
      );
      expect(tooltip).toBeInTheDocument();
      const text = tooltip!.textContent;
      expect(text).toContain("Total Books");
      expect(text).toContain("Total NonPrint");
      expect(text).toContain("Total");
    });
  });

  it("shows Young Adult Fiction / Non-Fiction breakdown in Young Adult tooltip", async () => {
    mockFetchOk(makeApiData({ withBreakdown: true }));
    const { container } = render(<CirculationTrends />);
    await waitFor(() => {
      expect(container.querySelectorAll("circle[stroke='white']")).toHaveLength(
        60,
      );
    });

    // Young Adult is the 2nd chart (indices 12-23)
    const yaFirstGroup = container.querySelectorAll(
      "circle[stroke='white']",
    )[12].parentElement!;
    fireEvent.mouseEnter(yaFirstGroup);

    await waitFor(() => {
      const tooltip = container.querySelector(
        '[data-testid="circulation-tooltip"]',
      );
      expect(tooltip).toBeInTheDocument();
      const text = tooltip!.textContent;
      expect(text).toContain("Young Adult Fiction");
      expect(text).toContain("Young Adult Non-Fiction");
      expect(text).toContain("Total");
    });
  });

  it("shows Adult Fiction / Non-Fiction breakdown in Adult tooltip", async () => {
    mockFetchOk(makeApiData({ withBreakdown: true }));
    const { container } = render(<CirculationTrends />);
    await waitFor(() => {
      expect(container.querySelectorAll("circle[stroke='white']")).toHaveLength(
        60,
      );
    });

    // Adult is the 3rd chart (indices 24-35)
    const adultFirstGroup = container.querySelectorAll(
      "circle[stroke='white']",
    )[24].parentElement!;
    fireEvent.mouseEnter(adultFirstGroup);

    await waitFor(() => {
      const tooltip = container.querySelector(
        '[data-testid="circulation-tooltip"]',
      );
      expect(tooltip).toBeInTheDocument();
      const text = tooltip!.textContent;
      expect(text).toContain("Adult Fiction");
      expect(text).toContain("Adult Non-Fiction");
      expect(text).toContain("Total");
    });
  });
});
