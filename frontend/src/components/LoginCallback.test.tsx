import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import LoginCallback from "./LoginCallback";

const mockNavigate = vi.fn();
let mockSearch = "";

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: mockSearch }),
}));

describe("LoginCallback Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSearch = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the completing sign-in message", () => {
    render(<LoginCallback />);
    expect(screen.getByText("Completing your sign in...")).toBeInTheDocument();
  });

  it("navigates to '/' after 1 second when code and state params are present", async () => {
    mockSearch = "?code=auth_code&state=auth_state";
    render(<LoginCallback />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("does not navigate when code param is missing", () => {
    mockSearch = "?state=auth_state";
    render(<LoginCallback />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("does not navigate when state param is missing", () => {
    mockSearch = "?code=auth_code";
    render(<LoginCallback />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("does not navigate before 1 second has elapsed", () => {
    mockSearch = "?code=auth_code&state=auth_state";
    render(<LoginCallback />);
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
