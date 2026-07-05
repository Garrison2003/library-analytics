import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "./Login";
import { useAuth0 } from "@auth0/auth0-react";

vi.mock("@auth0/auth0-react");

describe("Login Component", () => {
  const mockLoginWithRedirect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth0 as any).mockReturnValue({
      loginWithRedirect: mockLoginWithRedirect,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it("renders app title and tagline", () => {
    render(<Login />);
    expect(screen.getByText("Library Analytics")).toBeInTheDocument();
    expect(screen.getByText("Data Intelligence Platform")).toBeInTheDocument();
  });

  it("renders the Welcome Back heading", () => {
    render(<Login />);
    expect(
      screen.getByRole("heading", { name: /Welcome Back/i }),
    ).toBeInTheDocument();
  });

  it("renders the sign-in description", () => {
    render(<Login />);
    expect(
      screen.getByText(/Sign in to access your library circulation analytics/i),
    ).toBeInTheDocument();
  });

  it("renders the Auth0 login button", () => {
    render(<Login />);
    expect(
      screen.getByRole("button", { name: /Sign in with Auth0/i }),
    ).toBeInTheDocument();
  });

  it("calls loginWithRedirect when button is clicked", async () => {
    const user = userEvent.setup();
    render(<Login />);
    await user.click(screen.getByRole("button", { name: /Sign in with Auth0/i }));
    expect(mockLoginWithRedirect).toHaveBeenCalledOnce();
  });

  it("renders all four feature list items", () => {
    render(<Login />);
    expect(screen.getByText("Real-time circulation tracking")).toBeInTheDocument();
    expect(screen.getByText("Visual analytics and trends")).toBeInTheDocument();
    expect(screen.getByText("AI-powered insights")).toBeInTheDocument();
    expect(screen.getByText("Data import & management")).toBeInTheDocument();
  });

  it("renders the security notice", () => {
    render(<Login />);
    expect(screen.getByText(/Secured with Auth0/i)).toBeInTheDocument();
    expect(screen.getByText(/Enterprise-grade security/i)).toBeInTheDocument();
  });
});
