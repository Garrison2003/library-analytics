import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccessDenied from "./AccessDenied";

describe("AccessDenied Component", () => {
  beforeEach(() => {
    vi.stubGlobal("location", { reload: vi.fn(), href: "" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the Access Denied heading", () => {
    render(<AccessDenied />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Access Denied/i }),
    ).toBeInTheDocument();
  });

  it("renders the error description", () => {
    render(<AccessDenied />);
    expect(
      screen.getByText(/We encountered an issue during authentication/i),
    ).toBeInTheDocument();
  });

  it("renders the Troubleshooting heading", () => {
    render(<AccessDenied />);
    expect(screen.getByText("Troubleshooting:")).toBeInTheDocument();
  });

  it("renders all four troubleshooting steps", () => {
    render(<AccessDenied />);
    expect(
      screen.getByText(/Verify VITE_AUTH0_DOMAIN is set correctly/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Verify VITE_AUTH0_CLIENT_ID is set correctly/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Check Auth0 dashboard for allowed callback URLs/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ensure your network connection is stable/i),
    ).toBeInTheDocument();
  });

  it("renders the Try Again button", () => {
    render(<AccessDenied />);
    expect(
      screen.getByRole("button", { name: /Try Again/i }),
    ).toBeInTheDocument();
  });

  it("renders the Go Home button", () => {
    render(<AccessDenied />);
    expect(
      screen.getByRole("button", { name: /Go Home/i }),
    ).toBeInTheDocument();
  });

  it("calls window.location.reload when Try Again is clicked", async () => {
    const user = userEvent.setup();
    render(<AccessDenied />);
    await user.click(screen.getByRole("button", { name: /Try Again/i }));
    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  it("sets window.location.href to '/' when Go Home is clicked", async () => {
    const user = userEvent.setup();
    render(<AccessDenied />);
    await user.click(screen.getByRole("button", { name: /Go Home/i }));
    expect(window.location.href).toBe("/");
  });

  it("renders a link to Auth0 documentation", () => {
    render(<AccessDenied />);
    const link = screen.getByRole("link", { name: /View Auth0 documentation/i });
    expect(link).toHaveAttribute("href", "https://auth0.com/docs");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
