import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Upload from "./Upload";

vi.mock("../services/api", () => ({
  apiClient: { uploadFile: vi.fn() },
  default: class {},
}));

import { apiClient } from "../services/api";
const mockUploadFile = apiClient.uploadFile as ReturnType<typeof vi.fn>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeXlsm(name = "FY2026.xlsm") {
  return new File(["data"], name, {
    type: "application/vnd.ms-excel.sheet.macroEnabled.12",
  });
}

function selectFile(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]')!;
  Object.defineProperty(input, "files", {
    value: { 0: file, length: 1, item: () => file },
    configurable: true,
  });
  fireEvent.change(input);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Upload Component", () => {
  beforeEach(() => {
    mockUploadFile.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Layout ──────────────────────────────────────────────────────────────────

  it("renders the page heading", () => {
    render(<Upload onBackHome={vi.fn()} />);
    expect(screen.getByText("Upload Data Files")).toBeInTheDocument();
  });

  it("renders the page subtitle", () => {
    render(<Upload onBackHome={vi.fn()} />);
    expect(
      screen.getByText(/Select a file type and upload your data/i),
    ).toBeInTheDocument();
  });

  it("renders both file type options", () => {
    render(<Upload onBackHome={vi.fn()} />);
    expect(screen.getByText("Circulation Statistics")).toBeInTheDocument();
    expect(screen.getByText("Program Reports")).toBeInTheDocument();
  });

  it("renders the drag-and-drop zone by default", () => {
    render(<Upload onBackHome={vi.fn()} />);
    expect(
      screen.getByText(/Drag and drop your file here/i),
    ).toBeInTheDocument();
  });

  it("renders the Back to Home button", () => {
    render(<Upload onBackHome={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /Back to Home/i }),
    ).toBeInTheDocument();
  });

  it("calls onBackHome when Back to Home is clicked", async () => {
    const user = userEvent.setup();
    const onBackHome = vi.fn();
    render(<Upload onBackHome={onBackHome} />);
    await user.click(screen.getByRole("button", { name: /Back to Home/i }));
    expect(onBackHome).toHaveBeenCalledOnce();
  });

  // ── File type selection ──────────────────────────────────────────────────────

  it("shows file type help text when a type is selected", async () => {
    const user = userEvent.setup();
    render(<Upload onBackHome={vi.fn()} />);
    await user.click(screen.getByText("Circulation Statistics"));
    await waitFor(() =>
      expect(
        screen.getByText(/Upload FY circulation statistics/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows allowed formats when a file type is selected", async () => {
    const user = userEvent.setup();
    render(<Upload onBackHome={vi.fn()} />);
    await user.click(screen.getByText("Circulation Statistics"));
    await waitFor(() =>
      expect(screen.getByText(/Formats:/i)).toBeInTheDocument(),
    );
  });

  // ── File validation errors ───────────────────────────────────────────────────

  it("shows error when dropped file extension doesn't match selected type", async () => {
    const { container } = render(<Upload onBackHome={vi.fn()} />);
    // Select Program Reports (expects .pdf)
    fireEvent.click(screen.getByText("Program Reports"));
    const wrongFile = makeXlsm("wrong.xlsm");
    selectFile(container, wrongFile);
    await waitFor(() =>
      expect(screen.getByText("Validation Error")).toBeInTheDocument(),
    );
  });

  it("shows error when file extension is unsupported", async () => {
    const { container } = render(<Upload onBackHome={vi.fn()} />);
    const badFile = new File(["data"], "data.csv", { type: "text/csv" });
    selectFile(container, badFile);
    await waitFor(() =>
      expect(screen.getByText("Validation Error")).toBeInTheDocument(),
    );
  });

  // ── Valid file selection ─────────────────────────────────────────────────────

  it("shows selected file name after choosing a valid xlsx", async () => {
    const { container } = render(<Upload onBackHome={vi.fn()} />);
    fireEvent.click(screen.getByText("Circulation Statistics"));
    selectFile(container, makeXlsm());
    await waitFor(() =>
      expect(screen.getByText("FY2026.xlsm")).toBeInTheDocument(),
    );
  });

  it("shows Upload File button after a valid file is selected", async () => {
    const { container } = render(<Upload onBackHome={vi.fn()} />);
    fireEvent.click(screen.getByText("Circulation Statistics"));
    selectFile(container, makeXlsm());
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Upload File/i }),
      ).toBeInTheDocument(),
    );
  });

  it("shows Clear button after a valid file is selected", async () => {
    const { container } = render(<Upload onBackHome={vi.fn()} />);
    fireEvent.click(screen.getByText("Circulation Statistics"));
    selectFile(container, makeXlsm());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Clear/i })).toBeInTheDocument(),
    );
  });

  it("clears file selection when Clear is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<Upload onBackHome={vi.fn()} />);
    fireEvent.click(screen.getByText("Circulation Statistics"));
    selectFile(container, makeXlsm());
    await waitFor(() => screen.getByRole("button", { name: /Clear/i }));
    await user.click(screen.getByRole("button", { name: /Clear/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/Drag and drop your file here/i),
      ).toBeInTheDocument(),
    );
  });

  // ── Upload success ───────────────────────────────────────────────────────────

  it("shows success message on successful upload", async () => {
    const user = userEvent.setup();
    mockUploadFile.mockResolvedValueOnce({ success: true, data: {} });
    const { container } = render(<Upload onBackHome={vi.fn()} />);
    fireEvent.click(screen.getByText("Circulation Statistics"));
    selectFile(container, makeXlsm());
    await waitFor(() => screen.getByRole("button", { name: /Upload File/i }));
    await user.click(screen.getByRole("button", { name: /Upload File/i }));
    await waitFor(() =>
      expect(screen.getByText("Upload Successful!")).toBeInTheDocument(),
    );
  });

  it("calls apiClient.uploadFile with the selected file", async () => {
    const user = userEvent.setup();
    mockUploadFile.mockResolvedValueOnce({ success: true, data: {} });
    const { container } = render(<Upload onBackHome={vi.fn()} />);
    fireEvent.click(screen.getByText("Circulation Statistics"));
    const file = makeXlsm();
    selectFile(container, file);
    await waitFor(() => screen.getByRole("button", { name: /Upload File/i }));
    await user.click(screen.getByRole("button", { name: /Upload File/i }));
    expect(mockUploadFile).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ fileType: "circulation" }),
    );
  });

  it("derives fileType from extension when no file type card is selected", async () => {
    const user = userEvent.setup();
    mockUploadFile.mockResolvedValueOnce({ success: true, data: {} });
    const { container } = render(<Upload onBackHome={vi.fn()} />);
    // Do NOT click a file type card — select file directly
    const file = makeXlsm();
    selectFile(container, file);
    await waitFor(() => screen.getByRole("button", { name: /Upload File/i }));
    await user.click(screen.getByRole("button", { name: /Upload File/i }));
    expect(mockUploadFile).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ fileType: "circulation" }),
    );
  });

  // ── Upload error ─────────────────────────────────────────────────────────────

  it("shows error message when upload returns failure", async () => {
    const user = userEvent.setup();
    mockUploadFile.mockResolvedValueOnce({
      success: false,
      error: { message: "Server rejected the file" },
    });
    const { container } = render(<Upload onBackHome={vi.fn()} />);
    fireEvent.click(screen.getByText("Circulation Statistics"));
    selectFile(container, makeXlsm());
    await waitFor(() => screen.getByRole("button", { name: /Upload File/i }));
    await user.click(screen.getByRole("button", { name: /Upload File/i }));
    await waitFor(() =>
      expect(screen.getByText("Upload Failed")).toBeInTheDocument(),
    );
  });

  it("shows error message when upload throws", async () => {
    const user = userEvent.setup();
    mockUploadFile.mockRejectedValueOnce(new Error("Network error"));
    const { container } = render(<Upload onBackHome={vi.fn()} />);
    fireEvent.click(screen.getByText("Circulation Statistics"));
    selectFile(container, makeXlsm());
    await waitFor(() => screen.getByRole("button", { name: /Upload File/i }));
    await user.click(screen.getByRole("button", { name: /Upload File/i }));
    await waitFor(() =>
      expect(screen.getByText("Network error")).toBeInTheDocument(),
    );
  });

  // ── File exists / overwrite ──────────────────────────────────────────────────

  it("shows overwrite dialog when server returns FILE_EXISTS", async () => {
    const user = userEvent.setup();
    mockUploadFile.mockResolvedValueOnce({
      success: false,
      error: { code: "FILE_EXISTS", message: "'FY2026.xlsm' already exists." },
    });
    const { container } = render(<Upload onBackHome={vi.fn()} />);
    fireEvent.click(screen.getByText("Circulation Statistics"));
    selectFile(container, makeXlsm());
    await waitFor(() => screen.getByRole("button", { name: /Upload File/i }));
    await user.click(screen.getByRole("button", { name: /Upload File/i }));
    await waitFor(() =>
      expect(screen.getByText("File Already Exists")).toBeInTheDocument(),
    );
  });

  it("calls uploadFile with overwrite:true when Replace File is clicked", async () => {
    const user = userEvent.setup();
    mockUploadFile
      .mockResolvedValueOnce({
        success: false,
        error: { code: "FILE_EXISTS", message: "'FY2026.xlsm' already exists." },
      })
      .mockResolvedValueOnce({ success: true, data: {} });
    const { container } = render(<Upload onBackHome={vi.fn()} />);
    fireEvent.click(screen.getByText("Circulation Statistics"));
    selectFile(container, makeXlsm());
    await waitFor(() => screen.getByRole("button", { name: /Upload File/i }));
    await user.click(screen.getByRole("button", { name: /Upload File/i }));
    await waitFor(() => screen.getByRole("button", { name: /Replace File/i }));
    await user.click(screen.getByRole("button", { name: /Replace File/i }));
    expect(mockUploadFile).toHaveBeenLastCalledWith(
      expect.any(File),
      expect.objectContaining({ overwrite: true }),
    );
  });

  it("dismisses the overwrite dialog when Cancel is clicked", async () => {
    const user = userEvent.setup();
    mockUploadFile.mockResolvedValueOnce({
      success: false,
      error: { code: "FILE_EXISTS", message: "'FY2026.xlsm' already exists." },
    });
    const { container } = render(<Upload onBackHome={vi.fn()} />);
    fireEvent.click(screen.getByText("Circulation Statistics"));
    selectFile(container, makeXlsm());
    await waitFor(() => screen.getByRole("button", { name: /Upload File/i }));
    await user.click(screen.getByRole("button", { name: /Upload File/i }));
    await waitFor(() => screen.getByRole("button", { name: /Cancel/i }));
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    await waitFor(() =>
      expect(screen.queryByText("File Already Exists")).not.toBeInTheDocument(),
    );
  });

  // ── Drag and drop ────────────────────────────────────────────────────────────

  it("highlights drop zone on dragover", async () => {
    const { container } = render(<Upload onBackHome={vi.fn()} />);
    const dropZone = container.querySelector(".border-dashed")!;
    fireEvent.dragOver(dropZone);
    expect(dropZone.className).toContain("border-blue-500");
  });

  it("removes highlight on dragleave", async () => {
    const { container } = render(<Upload onBackHome={vi.fn()} />);
    const dropZone = container.querySelector(".border-dashed")!;
    fireEvent.dragOver(dropZone);
    fireEvent.dragLeave(dropZone);
    expect(dropZone.className).not.toContain("border-blue-500");
  });

  it("shows validation error when unsupported file is dropped", async () => {
    const { container } = render(<Upload onBackHome={vi.fn()} />);
    const dropZone = container.querySelector(".border-dashed")!;
    const badFile = new File(["data"], "data.csv", { type: "text/csv" });
    fireEvent.drop(dropZone, {
      dataTransfer: { files: { 0: badFile, length: 1, item: () => badFile } },
    });
    await waitFor(() =>
      expect(screen.getByText("Validation Error")).toBeInTheDocument(),
    );
  });
});
