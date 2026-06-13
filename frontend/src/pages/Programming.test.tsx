import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Programming from "./Programming";

vi.mock("../components/ProgrammingCharts", () => ({
  default: ({ selectedBranch }: { selectedBranch?: string }) => (
    <div data-testid="mock-programming-charts" data-branch={selectedBranch}>
      <span>In-Person Attendance</span>
      <span>Total Programs</span>
    </div>
  ),
}));

vi.mock("../components/ProgrammingQuery", () => ({
  default: ({
    branches,
    selectedBranch,
  }: {
    branches: string[];
    selectedBranch: string;
  }) => (
    <div
      data-testid="mock-programming-query"
      data-branch-count={branches.length}
      data-selected-branch={selectedBranch}
    />
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
    askQuestion: vi.fn(),
  },
}));

import { apiClient } from "../services/api";

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

describe("Programming Page", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ── Static layout ────────────────────────────────────────────────────────────

  it("renders the Programming hero heading", () => {
    mockFetchBranches([]);
    render(<Programming />);
    expect(
      screen.getByRole("heading", { name: "Programming", level: 1 }),
    ).toBeInTheDocument();
  });

  it("renders the hero subtitle", () => {
    mockFetchBranches([]);
    render(<Programming />);
    expect(
      screen.getByText(/Explore programming attendance and event totals/i),
    ).toBeInTheDocument();
  });

  it("renders the Questions section heading", () => {
    mockFetchBranches([]);
    render(<Programming />);
    expect(
      screen.getByRole("heading", { name: "Questions", level: 2 }),
    ).toBeInTheDocument();
  });

  it("renders the questions textarea", () => {
    mockFetchBranches([]);
    render(<Programming />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders the ProgrammingCharts component", () => {
    mockFetchBranches([]);
    render(<Programming />);
    expect(screen.getByTestId("mock-programming-charts")).toBeInTheDocument();
  });

  it("renders the Query Sessions section heading", () => {
    mockFetchBranches([]);
    render(<Programming />);
    expect(
      screen.getByRole("heading", { name: "Query Sessions", level: 2 }),
    ).toBeInTheDocument();
  });

  it("renders the ProgrammingQuery component", () => {
    mockFetchBranches([]);
    render(<Programming />);
    expect(screen.getByTestId("mock-programming-query")).toBeInTheDocument();
  });

  // ── Branch fetching ──────────────────────────────────────────────────────────

  it("shows loading state for branch selector on mount", () => {
    vi.mocked(apiClient.getCirculationData).mockReturnValue(new Promise(() => {}));
    render(<Programming />);
    expect(screen.getByTestId("branch-loading")).toBeInTheDocument();
  });

  it("fetches branches from the circulation endpoint", async () => {
    mockFetchBranches(["Imaginon", "Main"]);
    render(<Programming />);
    await waitFor(() => {
      expect(apiClient.getCirculationData).toHaveBeenCalled();
    });
  });

  it("populates BranchSelector with fetched branches", async () => {
    mockFetchBranches(["Imaginon", "Main"]);
    render(<Programming />);
    await waitFor(() =>
      expect(screen.getByTestId("branch-count").textContent).toBe("2"),
    );
  });

  it("defaults to the first branch when branches are available", async () => {
    mockFetchBranches(["Imaginon", "Main", "Plaza Midwood"]);
    render(<Programming />);
    await waitFor(() =>
      expect(screen.getByTestId("selected-branch").textContent).toBe("Imaginon"),
    );
  });

  it("defaults to System when branch list is empty", async () => {
    mockFetchBranches([]);
    render(<Programming />);
    await waitFor(() =>
      expect(screen.getByTestId("selected-branch").textContent).toBe("System"),
    );
  });

  it("defaults to System when fetch fails", async () => {
    mockFetchFail();
    render(<Programming />);
    await waitFor(() =>
      expect(screen.getByTestId("selected-branch").textContent).toBe("System"),
    );
  });

  it("resolves loading state even when API call fails", async () => {
    mockFetchFail();
    render(<Programming />);
    await waitFor(() =>
      expect(screen.queryByTestId("branch-loading")).not.toBeInTheDocument(),
    );
  });

  it("passes selectedBranch to ProgrammingCharts", async () => {
    mockFetchBranches(["Imaginon"]);
    render(<Programming />);
    await waitFor(() =>
      expect(
        screen.getByTestId("mock-programming-charts").dataset.branch,
      ).toBe("Imaginon"),
    );
  });

  it("shows programming section heading with selected branch name", async () => {
    mockFetchBranches(["Main"]);
    render(<Programming />);
    await waitFor(() =>
      expect(screen.getByText(/Programming for Main/i)).toBeInTheDocument(),
    );
  });
});
