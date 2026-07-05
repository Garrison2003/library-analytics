import { describe, it, expect } from "vitest";
import {
  APP_NAME,
  APP_VERSION,
  MONTHS,
  CATEGORIES,
  COLORS,
  FILE_UPLOAD_CONFIG,
  VALIDATION_RULES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  formatPercentage,
  calculatePercentageChange,
  validateEmail,
  validateQuestion,
  validateFile,
  validateCSVData,
} from "./utilities";

describe("Constants", () => {
  it("APP_NAME is 'Library Analytics'", () => {
    expect(APP_NAME).toBe("Library Analytics");
  });

  it("APP_VERSION is '1.0.0'", () => {
    expect(APP_VERSION).toBe("1.0.0");
  });

  it("MONTHS has 12 entries starting with January", () => {
    expect(MONTHS).toHaveLength(12);
    expect(MONTHS[0]).toBe("January");
    expect(MONTHS[11]).toBe("December");
  });

  it("CATEGORIES includes Juvenile Fiction and Young Adult", () => {
    expect(CATEGORIES).toContain("Juvenile Fiction");
    expect(CATEGORIES).toContain("Young Adult");
  });

  it("COLORS has primary, success, and danger keys", () => {
    expect(COLORS).toHaveProperty("primary");
    expect(COLORS).toHaveProperty("success");
    expect(COLORS).toHaveProperty("danger");
  });

  it("FILE_UPLOAD_CONFIG maxFileSize is 10 MB", () => {
    expect(FILE_UPLOAD_CONFIG.maxFileSize).toBe(10 * 1024 * 1024);
  });

  it("VALIDATION_RULES question minLength is 5", () => {
    expect(VALIDATION_RULES.question.minLength).toBe(5);
    expect(VALIDATION_RULES.question.maxLength).toBe(500);
  });

  it("ERROR_MESSAGES has expected keys", () => {
    expect(ERROR_MESSAGES.NETWORK_ERROR).toBeDefined();
    expect(ERROR_MESSAGES.INVALID_FILE).toBeDefined();
    expect(ERROR_MESSAGES.INVALID_QUESTION).toBeDefined();
  });

  it("SUCCESS_MESSAGES has expected keys", () => {
    expect(SUCCESS_MESSAGES.FILE_UPLOADED).toBeDefined();
    expect(SUCCESS_MESSAGES.QUESTION_SUBMITTED).toBeDefined();
  });
});

describe("formatCurrency", () => {
  it("formats a positive number as USD", () => {
    expect(formatCurrency(1234.56)).toContain("1,234.56");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toContain("0.00");
  });

  it("includes the dollar sign", () => {
    expect(formatCurrency(100)).toContain("$");
  });
});

describe("formatNumber", () => {
  it("formats with thousand separators and no decimals by default", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("formats with the specified number of decimals", () => {
    expect(formatNumber(1234.5, 2)).toBe("1,234.50");
  });

  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0");
  });
});

describe("formatDate", () => {
  it("formats a Date object to a readable string", () => {
    const date = new Date(2026, 0, 15);
    const result = formatDate(date);
    expect(result).toContain("2026");
    expect(result).toContain("January");
    expect(result).toContain("15");
  });

  it("accepts a date string", () => {
    const result = formatDate("2026-05-23T00:00:00");
    expect(result).toContain("2026");
  });
});

describe("formatDateTime", () => {
  it("formats a Date object with date and time parts", () => {
    const date = new Date(2026, 0, 15, 10, 30);
    const result = formatDateTime(date);
    expect(result).toContain("2026");
    expect(result).toContain("Jan");
    expect(result).toContain("15");
  });

  it("accepts a date string", () => {
    const result = formatDateTime("2026-05-23T14:00:00");
    expect(result).toContain("2026");
  });
});

describe("formatPercentage", () => {
  it("formats 0.5 as '50.0%'", () => {
    expect(formatPercentage(0.5)).toBe("50.0%");
  });

  it("formats 0 as '0.0%'", () => {
    expect(formatPercentage(0)).toBe("0.0%");
  });

  it("respects custom decimal places", () => {
    expect(formatPercentage(0.1234, 2)).toBe("12.34%");
  });

  it("formats 1 as '100.0%'", () => {
    expect(formatPercentage(1)).toBe("100.0%");
  });
});

describe("calculatePercentageChange", () => {
  it("calculates positive growth correctly", () => {
    expect(calculatePercentageChange(110, 100)).toBeCloseTo(0.1);
  });

  it("calculates negative growth correctly", () => {
    expect(calculatePercentageChange(90, 100)).toBeCloseTo(-0.1);
  });

  it("returns 0 when there is no change", () => {
    expect(calculatePercentageChange(100, 100)).toBe(0);
  });

  it("returns 0 when previous value is 0 (avoids division by zero)", () => {
    expect(calculatePercentageChange(100, 0)).toBe(0);
  });
});

describe("validateEmail", () => {
  it("returns true for a valid email", () => {
    expect(validateEmail("user@example.com")).toBe(true);
  });

  it("returns true for an email with subdomain", () => {
    expect(validateEmail("user@mail.example.com")).toBe(true);
  });

  it("returns false when @ is missing", () => {
    expect(validateEmail("userexample.com")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(validateEmail("")).toBe(false);
  });

  it("returns false when domain is missing", () => {
    expect(validateEmail("user@")).toBe(false);
  });
});

describe("validateQuestion", () => {
  it("returns true for a valid question", () => {
    expect(validateQuestion("What is the trend?")).toBe(true);
  });

  it("returns true for exactly 5 characters", () => {
    expect(validateQuestion("Hello")).toBe(true);
  });

  it("returns false for fewer than 5 characters", () => {
    expect(validateQuestion("Hi")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(validateQuestion("")).toBe(false);
  });

  it("returns false for more than 500 characters", () => {
    expect(validateQuestion("a".repeat(501))).toBe(false);
  });

  it("trims whitespace before checking length", () => {
    expect(validateQuestion("   Hi  ")).toBe(false);
    expect(validateQuestion("   Hello World   ")).toBe(true);
  });
});

describe("validateFile", () => {
  const makeFile = (name: string, size: number) => {
    const file = new File([""], name);
    Object.defineProperty(file, "size", { value: size });
    return file;
  };

  it("returns valid for a csv file within the size limit", () => {
    expect(validateFile(makeFile("data.csv", 1024))).toEqual({ valid: true });
  });

  it("returns valid for an xlsx file", () => {
    expect(validateFile(makeFile("data.xlsx", 1024))).toEqual({ valid: true });
  });

  it("returns valid for a json file", () => {
    expect(validateFile(makeFile("data.json", 1024))).toEqual({ valid: true });
  });

  it("returns invalid with an error when the file exceeds 10 MB", () => {
    const result = validateFile(makeFile("data.csv", 11 * 1024 * 1024));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too large");
  });

  it("returns invalid with an error for an unsupported format", () => {
    const result = validateFile(makeFile("data.pdf", 1024));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid file format");
  });

  it("respects custom allowedFormats", () => {
    const result = validateFile(makeFile("data.csv", 1024), ["xlsx"]);
    expect(result.valid).toBe(false);
  });
});

describe("validateCSVData", () => {
  it("returns true when all rows have the same column count as the header", () => {
    expect(
      validateCSVData([
        ["name", "count"],
        ["Juvenile Fiction", "600"],
        ["Young Adult", "450"],
      ]),
    ).toBe(true);
  });

  it("returns false for empty data", () => {
    expect(validateCSVData([])).toBe(false);
  });

  it("returns false when a row has a different column count than the header", () => {
    expect(
      validateCSVData([
        ["name", "count"],
        ["Juvenile Fiction"],
      ]),
    ).toBe(false);
  });

  it("returns true for a single-row dataset", () => {
    expect(validateCSVData([["header1", "header2"]])).toBe(true);
  });
});
