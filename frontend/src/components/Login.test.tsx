import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "../components/Login";
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

  it("renders login container with header", () => {
    render(<Login />);
    expect(screen.getByText("Library Analytics")).toBeInTheDocument();
    expect(
      screen.getByText("Sign in with your Auth0 account"),
    ).toBeInTheDocument();
  });

  it("renders Auth0 login button", () => {
    render(<Login />);
    const button = screen.getByRole("button", { name: /Sign in with Auth0/i });
    expect(button).toBeInTheDocument();
  });

  it("calls loginWithRedirect when button is clicked", async () => {
    const user = userEvent.setup();
    render(<Login />);
    const button = screen.getByRole("button", { name: /Sign in with Auth0/i });

    await user.click(button);
    expect(mockLoginWithRedirect).toHaveBeenCalledOnce();
  });

  it("renders footer text", () => {
    render(<Login />);
    expect(
      screen.getByText(
        /Your credentials will be securely validated through Auth0/,
      ),
    ).toBeInTheDocument();
  });

  it("renders Auth0 logo SVG", () => {
    render(<Login />);
    const svg = document.querySelector(".auth0-logo");
    expect(svg).toBeInTheDocument();
  });
});
