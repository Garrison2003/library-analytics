import { describe, it, expect } from "vitest";
import {
  FILE_CONFIGURATIONS,
  getFileExtension,
  getFileConfig,
  getAvailableFileTypes,
  isValidFileExtension,
  getFileConfigByExtension,
  formatFileSize,
} from "./fileConfig";

// ── getFileExtension ──────────────────────────────────────────────────────────

describe("getFileExtension", () => {
  it("returns lowercase extension", () => {
    expect(getFileExtension("report.PDF")).toBe("pdf");
    expect(getFileExtension("data.XLSM")).toBe("xlsm");
  });

  it("returns the last extension for multi-part names", () => {
    expect(getFileExtension("archive.tar.gz")).toBe("gz");
  });

  it("returns empty string when there is no extension", () => {
    expect(getFileExtension("noextension")).toBe("");
  });

  it("handles filenames starting with a dot", () => {
    expect(getFileExtension(".gitignore")).toBe("gitignore");
  });
});

// ── getFileConfig ─────────────────────────────────────────────────────────────

describe("getFileConfig", () => {
  it("returns the config for a known file type id", () => {
    expect(getFileConfig("circulation")).toBe(FILE_CONFIGURATIONS.circulation);
    expect(getFileConfig("programs")).toBe(FILE_CONFIGURATIONS.programs);
  });

  it("returns null for an unknown id", () => {
    expect(getFileConfig("unknown")).toBeNull();
    expect(getFileConfig("")).toBeNull();
  });
});

// ── getAvailableFileTypes ─────────────────────────────────────────────────────

describe("getAvailableFileTypes", () => {
  it("returns all configured file types", () => {
    const types = getAvailableFileTypes();
    const ids = types.map((t) => t.id);
    expect(ids).toContain("circulation");
    expect(ids).toContain("programs");
  });

  it("returns objects with required fields", () => {
    for (const t of getAvailableFileTypes()) {
      expect(t).toHaveProperty("id");
      expect(t).toHaveProperty("displayName");
      expect(t).toHaveProperty("allowedExtensions");
      expect(t).toHaveProperty("maxSizeBytes");
    }
  });
});

// ── isValidFileExtension ──────────────────────────────────────────────────────

describe("isValidFileExtension", () => {
  it("returns true for xlsm", () => expect(isValidFileExtension("data.xlsm")).toBe(true));
  it("returns true for xlsx", () => expect(isValidFileExtension("data.xlsx")).toBe(true));
  it("returns true for pdf", () => expect(isValidFileExtension("report.pdf")).toBe(true));
  it("returns false for csv", () => expect(isValidFileExtension("data.csv")).toBe(false));
  it("returns false for txt", () => expect(isValidFileExtension("notes.txt")).toBe(false));
  it("returns false for no extension", () => expect(isValidFileExtension("nodot")).toBe(false));
});

// ── getFileConfigByExtension ──────────────────────────────────────────────────

describe("getFileConfigByExtension", () => {
  it("resolves xlsm to circulation", () =>
    expect(getFileConfigByExtension("FY2026.xlsm")?.id).toBe("circulation"));

  it("resolves xlsx to circulation", () =>
    expect(getFileConfigByExtension("data.xlsx")?.id).toBe("circulation"));

  it("resolves pdf to programs", () =>
    expect(getFileConfigByExtension("report.pdf")?.id).toBe("programs"));

  it("returns null for unsupported extensions", () =>
    expect(getFileConfigByExtension("data.csv")).toBeNull());
});

// ── formatFileSize ────────────────────────────────────────────────────────────

describe("formatFileSize", () => {
  it("returns '0 Bytes' for zero", () => expect(formatFileSize(0)).toBe("0 Bytes"));
  it("formats bytes", () => expect(formatFileSize(500)).toBe("500 Bytes"));
  it("formats KB", () => expect(formatFileSize(1024)).toBe("1 KB"));
  it("formats MB", () => expect(formatFileSize(1048576)).toBe("1 MB"));
  it("formats GB", () => expect(formatFileSize(1073741824)).toBe("1 GB"));
  it("rounds fractional values", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });
});

// ── FILE_CONFIGURATIONS shape ─────────────────────────────────────────────────

describe("FILE_CONFIGURATIONS", () => {
  describe("circulation", () => {
    const cfg = FILE_CONFIGURATIONS.circulation;

    it("allows xlsm and xlsx", () => {
      expect(cfg.allowedExtensions).toContain("xlsm");
      expect(cfg.allowedExtensions).toContain("xlsx");
    });

    it("has a 10 MB size limit", () => {
      expect(cfg.maxSizeBytes).toBe(10 * 1024 * 1024);
    });

    it("routes to uploads/circulation in S3", () => {
      expect(cfg.s3Destination).toBe("uploads/circulation");
    });

    it("has a validate function", () => {
      expect(typeof cfg.validate).toBe("function");
    });
  });

  describe("programs", () => {
    const cfg = FILE_CONFIGURATIONS.programs;

    it("allows pdf only", () => {
      expect(cfg.allowedExtensions).toEqual(["pdf"]);
    });

    it("has a 20 MB size limit", () => {
      expect(cfg.maxSizeBytes).toBe(20 * 1024 * 1024);
    });

    it("routes to uploads/programs in S3", () => {
      expect(cfg.s3Destination).toBe("uploads/programs");
    });
  });
});

// ── validateCirculationFile ───────────────────────────────────────────────────

describe("validateCirculationFile", () => {
  const validate = FILE_CONFIGURATIONS.circulation.validate!;

  it("rejects a non-Excel extension", async () => {
    const file = new File(["data"], "data.csv", { type: "text/csv" });
    const result = await validate(file);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/xlsm|xlsx/i);
  });

  it("rejects a wrong MIME type even with correct extension", async () => {
    const file = new File(["data"], "data.xlsm", { type: "text/plain" });
    const result = await validate(file);
    expect(result.valid).toBe(false);
  });

  it("accepts a valid xlsm with correct MIME", async () => {
    const file = new File(["data"], "data.xlsm", {
      type: "application/vnd.ms-excel.sheet.macroEnabled.12",
    });
    const result = await validate(file);
    expect(result.valid).toBe(true);
  });

  it("accepts a valid xlsx with spreadsheetml MIME", async () => {
    const file = new File(["data"], "data.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const result = await validate(file);
    expect(result.valid).toBe(true);
  });

  it("rejects a file exceeding 10 MB", async () => {
    const bigContent = new Uint8Array(11 * 1024 * 1024);
    const file = new File([bigContent], "data.xlsm", {
      type: "application/vnd.ms-excel.sheet.macroEnabled.12",
    });
    const result = await validate(file);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too large/i);
  });

  it("returns a server-validation warning on success", async () => {
    const file = new File(["data"], "data.xlsm", {
      type: "application/vnd.ms-excel.sheet.macroEnabled.12",
    });
    const result = await validate(file);
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.length).toBeGreaterThan(0);
  });
});

// ── validateProgramFile ───────────────────────────────────────────────────────

describe("validateProgramFile", () => {
  const validate = FILE_CONFIGURATIONS.programs.validate!;

  it("rejects a non-PDF extension", async () => {
    const file = new File(["data"], "report.docx", {
      type: "application/msword",
    });
    const result = await validate(file);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/pdf/i);
  });

  it("rejects wrong MIME type for PDF extension", async () => {
    const file = new File(["data"], "report.pdf", { type: "text/plain" });
    const result = await validate(file);
    expect(result.valid).toBe(false);
  });

  it("accepts a valid PDF with %PDF header", async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const file = new File([pdfBytes], "report.pdf", {
      type: "application/pdf",
    });
    const result = await validate(file);
    expect(result.valid).toBe(true);
  });

  it("rejects a PDF with wrong magic bytes", async () => {
    const badBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const file = new File([badBytes], "report.pdf", {
      type: "application/pdf",
    });
    const result = await validate(file);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/header/i);
  });

  it("rejects a file exceeding 20 MB", async () => {
    const bigContent = new Uint8Array(21 * 1024 * 1024);
    const file = new File([bigContent], "report.pdf", {
      type: "application/pdf",
    });
    const result = await validate(file);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too large/i);
  });
});
