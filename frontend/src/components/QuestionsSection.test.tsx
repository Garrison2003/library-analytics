import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuestionsSection from "./QuestionsSection";

describe("QuestionsSection Component", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSubmit.mockResolvedValue(undefined);
  });

  it("renders the textarea", () => {
    render(<QuestionsSection onSubmit={mockOnSubmit} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders the Ask Question button", () => {
    render(<QuestionsSection onSubmit={mockOnSubmit} />);
    expect(
      screen.getByRole("button", { name: /Ask Question/i }),
    ).toBeInTheDocument();
  });

  it("renders the Clear button", () => {
    render(<QuestionsSection onSubmit={mockOnSubmit} />);
    expect(
      screen.getByRole("button", { name: /Clear/i }),
    ).toBeInTheDocument();
  });

  it("Ask Question button is disabled when textarea is empty", () => {
    render(<QuestionsSection onSubmit={mockOnSubmit} />);
    expect(screen.getByRole("button", { name: /Ask Question/i })).toBeDisabled();
  });

  it("shows error when question is fewer than 5 characters", async () => {
    const user = userEvent.setup();
    render(<QuestionsSection onSubmit={mockOnSubmit} />);
    await user.type(screen.getByRole("textbox"), "Hi");
    await user.click(screen.getByRole("button", { name: /Ask Question/i }));
    expect(
      screen.getByText("Question must be at least 5 characters long"),
    ).toBeInTheDocument();
  });

  it("calls onSubmit with the trimmed question when valid", async () => {
    const user = userEvent.setup();
    render(<QuestionsSection onSubmit={mockOnSubmit} />);
    await user.type(
      screen.getByRole("textbox"),
      "What are the circulation trends?",
    );
    await user.click(screen.getByRole("button", { name: /Ask Question/i }));
    expect(mockOnSubmit).toHaveBeenCalledWith(
      "What are the circulation trends?",
    );
  });

  it("clears the textarea after a successful submission", async () => {
    const user = userEvent.setup();
    render(<QuestionsSection onSubmit={mockOnSubmit} />);
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "What are the circulation trends?");
    await user.click(screen.getByRole("button", { name: /Ask Question/i }));
    expect(textarea).toHaveValue("");
  });

  it("shows the error message returned by a failed submission", async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockRejectedValue(new Error("Server error"));
    render(<QuestionsSection onSubmit={mockOnSubmit} />);
    await user.type(
      screen.getByRole("textbox"),
      "What are the circulation trends?",
    );
    await user.click(screen.getByRole("button", { name: /Ask Question/i }));
    expect(screen.getByText("Server error")).toBeInTheDocument();
  });

  it("clears the textarea and error when Clear is clicked", async () => {
    const user = userEvent.setup();
    render(<QuestionsSection onSubmit={mockOnSubmit} />);
    await user.type(screen.getByRole("textbox"), "Hi");
    await user.click(screen.getByRole("button", { name: /Ask Question/i }));
    expect(
      screen.getByText("Question must be at least 5 characters long"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Clear/i }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(
      screen.queryByText("Question must be at least 5 characters long"),
    ).not.toBeInTheDocument();
  });

  it("renders suggested questions when not loading", () => {
    render(<QuestionsSection onSubmit={mockOnSubmit} />);
    expect(
      screen.getByText("What were the circulation trends last month?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Which category had the highest growth?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("How does Juvenile Fiction compare to Young Adult?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("What is the average daily circulation?"),
    ).toBeInTheDocument();
  });

  it("populates the textarea when a suggested question is clicked", async () => {
    const user = userEvent.setup();
    render(<QuestionsSection onSubmit={mockOnSubmit} />);
    await user.click(
      screen.getByText("What were the circulation trends last month?"),
    );
    expect(screen.getByRole("textbox")).toHaveValue(
      "What were the circulation trends last month?",
    );
  });

  it("shows loading button label when isLoading is true", () => {
    render(<QuestionsSection onSubmit={mockOnSubmit} isLoading={true} />);
    expect(
      screen.getByRole("button", { name: /Asking/i }),
    ).toBeInTheDocument();
  });

  it("shows loading analysis message when isLoading is true", () => {
    render(<QuestionsSection onSubmit={mockOnSubmit} isLoading={true} />);
    expect(
      screen.getByText("Analyzing your data and preparing a response..."),
    ).toBeInTheDocument();
  });

  it("hides suggested questions when isLoading is true", () => {
    render(<QuestionsSection onSubmit={mockOnSubmit} isLoading={true} />);
    expect(
      screen.queryByText("What were the circulation trends last month?"),
    ).not.toBeInTheDocument();
  });

  it("disables the textarea when isLoading is true", () => {
    render(<QuestionsSection onSubmit={mockOnSubmit} isLoading={true} />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("shows the character count as user types", async () => {
    const user = userEvent.setup();
    render(<QuestionsSection onSubmit={mockOnSubmit} />);
    expect(screen.getByText("0/500")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox"), "Hello");
    expect(screen.getByText("5/500")).toBeInTheDocument();
  });
});
