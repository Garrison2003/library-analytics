// src/utils/constants.ts

/**
 * Application Constants
 */

export const APP_NAME = "Library Analytics";
export const APP_VERSION = "1.0.0";

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MONTH_LABELS = [
  "May 2025",
  "Jun 2025",
  "Jul 2025",
  "Aug 2025",
  "Sep 2025",
  "Oct 2025",
  "Nov 2025",
  "Dec 2025",
  "Jan 2026",
  "Feb 2026",
  "Mar 2026",
  "Apr 2026",
];

export const CATEGORIES = [
  "Juvenile Fiction",
  "Young Adult",
  "Adult Fiction",
  "Non-Fiction",
  "Reference",
  "Children Books",
];

export const COLORS = {
  primary: "#0D94E8",
  success: "#38A169",
  warning: "#F76D3B",
  danger: "#EF4444",
  blue: "#2C3E50",
  lightGray: "#F5F5F5",
};

export const BREAKPOINTS = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

/**
 * API Configuration
 */
export const API_CONFIG = {
  baseURL: process.env.VITE_API_URL || "http://localhost:3000/api",
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};

/**
 * MCP Server Configuration
 */
export const MCP_CONFIG = {
  serverURL: process.env.VITE_MCP_SERVER_URL || "http://localhost:3001/mcp",
  timeout: 60000,
  enabled: process.env.VITE_MCP_ENABLED !== "false",
};

/**
 * Cache Configuration
 */
export const CACHE_CONFIG = {
  enabled: true,
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxSize: 50, // Maximum number of cached items
};

/**
 * File Upload Configuration
 */
export const FILE_UPLOAD_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  allowedFormats: ["csv", "xlsx", "xls", "json"],
  allowedMimeTypes: [
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/json",
  ],
};

/**
 * Validation Rules
 */
export const VALIDATION_RULES = {
  question: {
    minLength: 5,
    maxLength: 500,
  },
  category: {
    minLength: 2,
    maxLength: 50,
  },
};

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: "Network error. Please check your connection.",
  TIMEOUT_ERROR: "Request timed out. Please try again.",
  INVALID_FILE: "Invalid file format. Please upload a CSV or Excel file.",
  FILE_TOO_LARGE: "File is too large. Maximum size is 10 MB.",
  INVALID_QUESTION: "Question must be between 5 and 500 characters.",
  SERVER_ERROR: "Server error. Please try again later.",
  UNAUTHORIZED: "You are not authorized to perform this action.",
  NOT_FOUND: "The requested resource was not found.",
};

/**
 * Success Messages
 */
export const SUCCESS_MESSAGES = {
  FILE_UPLOADED: "File uploaded successfully.",
  QUESTION_SUBMITTED: "Question submitted successfully.",
  DATA_SAVED: "Data saved successfully.",
};

// src/utils/formatters.ts

/**
 * Formatter Utilities
 */

/**
 * Format number as currency
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

/**
 * Format number with thousand separators
 */
export const formatNumber = (value: number, decimals: number = 0): string => {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Format date as readable string
 */
export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * Format date and time
 */
export const formatDateTime = (date: Date | string): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Format percentage
 */
export const formatPercentage = (
  value: number,
  decimals: number = 1,
): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * Calculate percentage change
 */
export const calculatePercentageChange = (
  current: number,
  previous: number,
): number => {
  if (previous === 0) return 0;
  return (current - previous) / previous;
};

// src/utils/validators.ts

/**
 * Validation Utilities
 */

/**
 * Validate email
 */
export const validateEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

/**
 * Validate question
 */
export const validateQuestion = (question: string): boolean => {
  const trimmed = question.trim();
  return trimmed.length >= 5 && trimmed.length <= 500;
};

/**
 * Validate file
 */
export const validateFile = (
  file: File,
  allowedFormats: string[] = ["csv", "xlsx", "json"],
): { valid: boolean; error?: string } => {
  // Check file size
  const maxSize = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: "File is too large. Maximum size is 10 MB.",
    };
  }

  // Check file format
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !allowedFormats.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file format. Allowed formats: ${allowedFormats.join(", ")}`,
    };
  }

  return { valid: true };
};

/**
 * Validate CSV data
 */
export const validateCSVData = (data: string[][]): boolean => {
  // Check if data is not empty
  if (data.length === 0) return false;

  // Check if all rows have same number of columns as header
  const headerLength = data[0].length;
  return data.every((row) => row.length === headerLength);
};
