import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "./Footer";

describe("Footer Component", () => {
  it("renders the current year in the copyright notice", () => {
    render(<Footer />);
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
  });

  it("renders copyright text", () => {
    render(<Footer />);
    expect(
      screen.getByText(/Library Analytics\. All rights reserved\./i),
    ).toBeInTheDocument();
  });

  it("renders the Privacy Policy link", () => {
    render(<Footer />);
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
  });

  it("renders the Terms of Service link", () => {
    render(<Footer />);
    expect(screen.getByText("Terms of Service")).toBeInTheDocument();
  });

  it("renders the Contact Support link", () => {
    render(<Footer />);
    expect(screen.getByText("Contact Support")).toBeInTheDocument();
  });

  it("renders the Documentation link", () => {
    render(<Footer />);
    expect(screen.getByText("Documentation")).toBeInTheDocument();
  });

  it("renders version info", () => {
    render(<Footer />);
    expect(screen.getByText(/Version 1\.0\.0/i)).toBeInTheDocument();
  });

  it("renders a footer element", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
