import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Homepage from "./Homepage";

// Mock API-fetching child components to isolate Homepage logic
vi.mock("../components/CirculationTrends", () => ({
  default: ({ selectedBranch }: { selectedBranch?: string }) => (
    <div data-testid="mock-circulation-trends" data-branch={selectedBranch}>
      <span>Juvenile Fiction</span>
      <span>Total Circulation</span>
    </div>
  ),
}));

vi.mock("../components/BranchSelector", () => ({
  default: ({
    branches,
    selectedBranch,
    isLoading,
  }: {
    branches: string[];
    selectedBranch: string;
    isLoading: boolean;
    onBranchChange: (b: string) => void;
  }) => (
    <div data-testid="mock-branch-selector">
      <span data-testid="branch-count">{branches.length}</span>
      <span data-testid="selected-branch">{selectedBranch}</span>
      {isLoading && <span data-testid="branch-loading">loading</span>}
    </div>
  ),
}));

vi.mock("../services/api", () => ({
  apiClient: {
    getCirculationData: vi.fn(),
  },
}));

import { apiClient } from "../services/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetchBranches(branches: string[]) {
  vi.mocked(apiClient.getCirculationData).mockResolvedValue({
    success: true,
    data: {
      branches,
      data: [],
      selectedBranch: "System",
      lastUpdated: new Date(),
      totalRecords: 0,
    },
    timestamp: new Date(),
    requestId: "test",
  });
}

function mockFetchFail() {
  vi.mocked(apiClient.getCirculationData).mockRejectedValue(
    new Error("Network error"),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Homepage Component", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ── Static layout ──────────────────────────────────────────────────────────

  it("renders the hero welcome message", () => {
    mockFetchBranches([]);
    render(<Homepage />);
    expect(screen.getByText("Welcome to Library Analytics")).toBeInTheDocument();
  });

  it("renders the hero subtitle", () => {
    mockFetchBranches([]);
    render(<Homepage />);
    expect(
      screen.getByText(/Analyze your library's performance/i),
    ).toBeInTheDocument();
  });

  it("renders the At a Glance section heading", () => {
    mockFetchBranches([]);
    render(<Homepage />);
    expect(screen.getByText("At a Glance")).toBeInTheDocument();
  });

  it("renders the Programming section heading", () => {
    mockFetchBranches([]);
    render(<Homepage />);
    expect(screen.getByText("Programming")).toBeInTheDocument();
  });

  it("renders the Questions section heading", () => {
    mockFetchBranches([]);
    render(<Homepage />);
    expect(screen.getByText("Questions")).toBeInTheDocument();
  });

  it("renders the questions input textarea", () => {
    mockFetchBranches([]);
    render(<Homepage />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders the CirculationTrends component inside At a Glance", () => {
    mockFetchBranches([]);
    render(<Homepage />);
    expect(screen.getByTestId("mock-circulation-trends")).toBeInTheDocument();
  });

  it("renders programming bar charts", () => {
    mockFetchBranches([]);
    render(<Homepage />);
    expect(screen.getByText("In-Person Attendance")).toBeInTheDocument();
    expect(screen.getByText("Total Programs")).toBeInTheDocument();
  });

  // ── Branch fetching ────────────────────────────────────────────────────────

  it("shows loading state for branch selector on mount", () => {
    vi.mocked(apiClient.getCirculationData).mockReturnValue(
      new Promise(() => {}),
    );
    render(<Homepage />);
    expect(screen.getByTestId("branch-loading")).toBeInTheDocument();
  });

  it("fetches branches from the circulation endpoint", async () => {
    mockFetchBranches(["Imaginon", "Main", "Plaza Midwood"]);
    render(<Homepage />);
    await waitFor(() => {
      expect(apiClient.getCirculationData).toHaveBeenCalled();
    });
  });

  it("populates BranchSelector with fetched branches", async () => {
    mockFetchBranches(["Imaginon", "Main"]);
    render(<Homepage />);
    await waitFor(() =>
      expect(screen.getByTestId("branch-count").textContent).toBe("2"),
    );
  });

  it("defaults to the first branch when branches are available", async () => {
    mockFetchBranches(["Imaginon", "Main", "Plaza Midwood"]);
    render(<Homepage />);
    await waitFor(() =>
      expect(screen.getByTestId("selected-branch").textContent).toBe(
        "Imaginon",
      ),
    );
  });

  it("defaults to System when branch list is empty", async () => {
    mockFetchBranches([]);
    render(<Homepage />);
    await waitFor(() =>
      expect(screen.getByTestId("selected-branch").textContent).toBe("System"),
    );
  });

  it("defaults to System when fetch fails", async () => {
    mockFetchFail();
    render(<Homepage />);
    await waitFor(() =>
      expect(screen.getByTestId("selected-branch").textContent).toBe("System"),
    );
  });

  it("resolves loading state even when API call fails", async () => {
    mockFetchFail();
    render(<Homepage />);
    await waitFor(() =>
      expect(screen.queryByTestId("branch-loading")).not.toBeInTheDocument(),
    );
  });

  it("passes selectedBranch to CirculationTrends", async () => {
    mockFetchBranches(["Imaginon"]);
    render(<Homepage />);
    await waitFor(() =>
      expect(
        screen.getByTestId("mock-circulation-trends").dataset.branch,
      ).toBe("Imaginon"),
    );
  });

  it("shows circulation subtitle with selected branch name", async () => {
    mockFetchBranches(["Main"]);
    render(<Homepage />);
    await waitFor(() =>
      expect(
        screen.getByText(/Circulation trends for Main/i),
      ).toBeInTheDocument(),
    );
  });
});
