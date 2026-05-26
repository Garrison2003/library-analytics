import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Homepage from "./Homepage";

describe("Homepage Component", () => {
  it("renders the hero welcome message", () => {
    render(<Homepage />);
    expect(screen.getByText("Welcome to Library Analytics")).toBeInTheDocument();
  });

  it("renders the hero subtitle", () => {
    render(<Homepage />);
    expect(
      screen.getByText(/Analyze your library's performance/i),
    ).toBeInTheDocument();
  });

  it("renders the At a Glance section heading", () => {
    render(<Homepage />);
    expect(screen.getByText("At a Glance")).toBeInTheDocument();
  });

  it("renders the Programming section heading", () => {
    render(<Homepage />);
    expect(screen.getByText("Programming")).toBeInTheDocument();
  });

  it("renders the Questions section heading", () => {
    render(<Homepage />);
    expect(screen.getByText("Questions")).toBeInTheDocument();
  });

  it("renders the questions input textarea", () => {
    render(<Homepage />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders circulation trend charts inside At a Glance", () => {
    render(<Homepage />);
    expect(screen.getByText("Juvenile Fiction")).toBeInTheDocument();
    expect(screen.getByText("Total Circulation")).toBeInTheDocument();
  });

  it("renders programming bar charts", () => {
    render(<Homepage />);
    expect(screen.getByText("In-Person Attendance")).toBeInTheDocument();
    expect(screen.getByText("Total Programs")).toBeInTheDocument();
  });
});
