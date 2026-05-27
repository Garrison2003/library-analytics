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
    displayName: "Program Reports",
    description: "PDF reports containing program and outreach activity data",
    allowedExtensions: ["pdf"],
    acceptedMimeTypes: ["application/pdf"],
    maxSizeBytes: 20 * 1024 * 1024, // 20 MB
    s3Destination: "uploads/programs",
    validate: validateProgramFile,
    helpText: "Upload program report PDFs. File must be a valid PDF document.",
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
 * Validation function for program report files
 * Checks that the file is a valid PDF
 */
async function validateProgramFile(file: File): Promise<ValidationResult> {
  // Check file extension
  const extension = getFileExtension(file.name);
  if (extension !== "pdf") {
    return {
      valid: false,
      error: `Invalid file format. Expected .pdf, got .${extension}`,
    };
  }

  // Check MIME type
  if (file.type !== "application/pdf") {
    return {
      valid: false,
      error:
        "File does not appear to be a valid PDF. Please ensure you're uploading a PDF file.",
    };
  }

  // Check file size
  if (file.size > FILE_CONFIGURATIONS.programs.maxSizeBytes) {
    return {
      valid: false,
      error: `File is too large. Maximum size is 20 MB, your file is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`,
    };
  }

  // Check for PDF magic bytes (PDF files should start with %PDF)
  const header = await readFileHeader(file, 4);
  if (header !== "%PDF") {
    return {
      valid: false,
      error:
        "File does not appear to be a valid PDF. The file header is incorrect.",
    };
  }

  return {
    valid: true,
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

/**
 * Helper: Read first N bytes of file as string
 */
async function readFileHeader(file: File, length: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const buffer = e.target.result as ArrayBuffer;
        const view = new Uint8Array(buffer);
        const header = String.fromCharCode.apply(null, Array.from(view));
        resolve(header);
      } else {
        resolve("");
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file.slice(0, length));
  });
}
