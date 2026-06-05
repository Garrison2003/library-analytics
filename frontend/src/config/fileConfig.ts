/**
 * File Upload Configuration
 *
 * Defines supported file types, validation rules, and S3 destinations.
 * This is the single source of truth for file handling across the app.
 */

export interface FileTypeConfig {
  /** Unique identifier for the file type */
  id: string;

  /** User-friendly display name */
  displayName: string;

  /** Description of the file type */
  description: string;

  /** Allowed file extensions (without dot, lowercase) */
  allowedExtensions: string[];

  /** MIME types this file type accepts */
  acceptedMimeTypes: string[];

  /** Maximum file size in bytes */
  maxSizeBytes: number;

  /** S3 folder destination (without trailing slash) */
  s3Destination: string;

  /** Custom validation function */
  validate?: (file: File) => Promise<ValidationResult>;

  /** Help text for the user */
  helpText?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface FileTypeConfigMap {
  [key: string]: FileTypeConfig;
}

/**
 * File type configurations
 * Add new file types here as your system grows
 */
export const FILE_CONFIGURATIONS: FileTypeConfigMap = {
  circulation: {
    id: "circulation",
    displayName: "Circulation Statistics",
    description:
      "Excel workbook containing monthly circulation data by branch and category",
    allowedExtensions: ["xlsm", "xlsx"],
    acceptedMimeTypes: [
      "application/vnd.ms-excel.sheet.macroEnabled.12",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    maxSizeBytes: 10 * 1024 * 1024, // 10 MB
    s3Destination: "uploads/circulation",
    validate: validateCirculationFile,
    helpText:
      "Upload FY circulation statistics in Excel format. File should contain monthly data sheets.",
  },

  programs: {
    id: "programs",
    displayName: "Program Statistics",
    description:
      "Excel workbook or ILS PDF report containing monthly program attendance and activity data by branch",
    allowedExtensions: ["xlsx", "pdf"],
    acceptedMimeTypes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/pdf",
    ],
    maxSizeBytes: 20 * 1024 * 1024, // 20 MB
    s3Destination: "uploads/programming",
    validate: validateProgramFile,
    helpText:
      "Upload program statistics as an Excel file (e.g., IMG Monthly Stats FY26-28.xlsx) or an ILS In-House/Outreach PDF report (e.g., Spangler_In-House_Programs_April_2026.pdf).",
  },

  // Future file types can be added here
  // reports: { ... },
  // budget: { ... },
};

/**
 * Validation function for circulation files
 * Checks that the file is a valid Excel workbook with expected structure
 */
async function validateCirculationFile(file: File): Promise<ValidationResult> {
  // Check file extension
  const extension = getFileExtension(file.name);
  if (!["xlsm", "xlsx"].includes(extension)) {
    return {
      valid: false,
      error: `Invalid file format. Expected .xlsm or .xlsx, got .${extension}`,
    };
  }

  // Check MIME type
  if (!file.type.includes("spreadsheetml") && !file.type.includes("excel")) {
    return {
      valid: false,
      error:
        "File does not appear to be a valid Excel file. Please ensure you're uploading a .xlsx or .xlsm file.",
    };
  }

  // Check file size
  if (file.size > FILE_CONFIGURATIONS.circulation.maxSizeBytes) {
    return {
      valid: false,
      error: `File is too large. Maximum size is 10 MB, your file is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`,
    };
  }

  // Note: Additional validation (checking sheet structure) would happen on the backend
  // after file upload since we can't easily read Excel files client-side without libraries

  return {
    valid: true,
    warnings: [
      "File will be validated on the server for correct data structure.",
    ],
  };
}

/**
 * Validation function for program statistics files
 * Checks that the file is a valid Excel spreadsheet
 */
const KNOWN_BRANCH_NAMES = [
  "imaginon", "main", "plaza", "northlake", "charlotte",
  "spangler", "carmel", "community", "east", "west",
];

async function validateProgramFile(file: File): Promise<ValidationResult> {
  const extension = getFileExtension(file.name);

  if (file.size > FILE_CONFIGURATIONS.programs.maxSizeBytes) {
    return {
      valid: false,
      error: `File is too large. Maximum size is 20 MB, your file is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`,
    };
  }

  // ── PDF: ILS In-House or Outreach report ──────────────────────────────────
  if (extension === "pdf") {
    if (!file.type.includes("pdf")) {
      return { valid: false, error: "File does not appear to be a valid PDF." };
    }
    const nameLower = file.name.toLowerCase();
    const hasBranch = KNOWN_BRANCH_NAMES.some((b) => nameLower.includes(b));
    const hasReportType =
      nameLower.includes("in-house") || nameLower.includes("outreach");
    if (!hasBranch || !hasReportType) {
      return {
        valid: false,
        error:
          "PDF filename should include a branch name and report type (e.g., Spangler_In-House_Programs_April_2026.pdf).",
      };
    }
    return {
      valid: true,
      warnings: ["PDF will be parsed on the server for Grand Summary totals."],
    };
  }

  // ── Excel: monthly stats workbook ─────────────────────────────────────────
  if (extension !== "xlsx") {
    return {
      valid: false,
      error: `Invalid file format. Expected .xlsx or .pdf, got .${extension}`,
    };
  }

  if (!file.type.includes("spreadsheetml")) {
    return {
      valid: false,
      error: "File does not appear to be a valid Excel file.",
    };
  }

  const codeMatch = file.name.match(/^([A-Z]{3})\s+/);
  if (!codeMatch) {
    return {
      valid: false,
      error:
        "Excel filename should start with a 3-letter branch code (e.g., IMG Monthly Stats FY26-28.xlsx).",
    };
  }

  return {
    valid: true,
    warnings: ["File will be validated on the server for correct data structure."],
  };
}

/**
 * Helper: Extract file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/**
 * Helper: Get file type config by ID
 */
export function getFileConfig(fileTypeId: string): FileTypeConfig | null {
  return FILE_CONFIGURATIONS[fileTypeId] || null;
}

/**
 * Helper: Get all available file types
 */
export function getAvailableFileTypes(): FileTypeConfig[] {
  return Object.values(FILE_CONFIGURATIONS);
}

/**
 * Helper: Check if a file extension is valid for any file type
 */
export function isValidFileExtension(filename: string): boolean {
  const extension = getFileExtension(filename);
  return getAvailableFileTypes().some((config) =>
    config.allowedExtensions.includes(extension),
  );
}

/**
 * Helper: Get file type config by file extension
 */
export function getFileConfigByExtension(
  filename: string,
): FileTypeConfig | null {
  const extension = getFileExtension(filename);
  const config = getAvailableFileTypes().find((c) =>
    c.allowedExtensions.includes(extension),
  );
  return config || null;
}

/**
 * Helper: Format bytes to human readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

