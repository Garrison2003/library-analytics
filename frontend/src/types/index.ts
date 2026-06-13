// src/types/index.ts
// Central location for all TypeScript types and interfaces

// ============================================================================
// CIRCULATION DATA TYPES
// ============================================================================

/**
 * Represents circulation data for a specific category and month
 */
export interface CirculationDataPoint {
  category: string;
  month: string; // Format: "May 2025"
  year: number;
  circulation: number;
  trend?: "up" | "down" | "stable";
  breakdown?: Record<string, number>; // Sub-category breakdown, e.g. { "Fiction": 4000, "Non-Fiction": 670 }
}

/**
 * Collection of circulation data points
 */
export interface CirculationData {
  data: CirculationDataPoint[];
  lastUpdated: Date;
  totalRecords: number;
  branches?: string[];
  selectedBranch?: string;
}

/**
 * Aggregated circulation metrics
 */
export interface CirculationMetrics {
  category: string;
  totalCirculation: number;
  averageMonthly: number;
  maxCirculation: number;
  minCirculation: number;
  growthRate: number; // Percentage
  trend: "increasing" | "decreasing" | "stable";
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

/**
 * Monthly analytics overview
 */
export interface MonthlyAnalytics {
  month: string;
  year: number;
  totalCirculation: number;
  categories: {
    [key: string]: number;
  };
  topCategory: string;
  comparisonsToLastMonth: {
    [key: string]: number; // Percentage change
  };
}

/**
 * Daily analytics data
 */
export interface DailyAnalytics {
  date: string; // ISO format: YYYY-MM-DD
  totalCirculation: number;
  categories: {
    [key: string]: number;
  };
  peakHours: string[];
  userCount: number;
}

/**
 * Analytics response with metadata
 */
export interface AnalyticsResponse<T> {
  data: T;
  metadata: {
    timestamp: Date;
    version: string;
    cached: boolean;
    cacheExpiry?: Date;
  };
}

// ============================================================================
// FILE UPLOAD TYPES
// ============================================================================

/**
 * File upload request
 */
export interface FileUploadRequest {
  file: File;
  category?: string;
  overwrite: boolean;
  validateOnly: boolean;
}

/**
 * File upload response
 */
export interface FileUploadResponse {
  success: boolean;
  fileName: string;
  recordsProcessed: number;
  recordsSkipped: number;
  errors: UploadError[];
  warnings: string[];
  timestamp: Date;
}

/**
 * File upload error
 */
export interface UploadError {
  row: number;
  column: string;
  message: string;
  severity: "error" | "warning";
}

/**
 * File validation result
 */
export interface FileValidationResult {
  valid: boolean;
  errors: UploadError[];
  warnings: string[];
  recordCount: number;
  categories: string[];
}

// ============================================================================
// PROGRAMMING SESSION TYPES
// ============================================================================

export interface ProgramSession {
  program_date: string;
  program_name: string;
  primary_facilitator: string;
  branch_code: string;
  branch_name: string;
  total_attendance: number;
  num_programs: number;
  report_type: string;
  outreach_site: string;
}

export interface ProgramSessionFilters {
  branch?: string;
  facilitator?: string;
  programName?: string;
  dateFrom?: string;
  dateTo?: string;
  reportType?: string;
}

export interface ProgramSessionsResponse {
  sessions: ProgramSession[];
  count: number;
  filters: {
    branch?: string | null;
    facilitator?: string | null;
    program_name?: string | null;
    date_from?: string | null;
    date_to?: string | null;
    report_type?: string | null;
  };
  message?: string;
}

export interface FacilitatorsResponse {
  facilitators: string[];
  branch: string;
  count: number;
}

// ============================================================================
// MCP SERVER & AI TYPES
// ============================================================================

/**
 * Question submitted by user
 */
export interface Question {
  id: string;
  query: string;
  category?: string;
  timeRange?: {
    startDate: string; // ISO format
    endDate: string; // ISO format
  };
  timestamp: Date;
  userId?: string;
}

/**
 * Answer from MCP server
 */
export interface Answer {
  id: string;
  questionId: string;
  response: string;
  confidence: number; // 0-1
  sources?: string[];
  metadata?: {
    model: string;
    processingTime: number; // milliseconds
    tokensUsed: number;
  };
  timestamp: Date;
}

/**
 * Question-Answer pair in history
 */
export interface QAHistory {
  question: Question;
  answer: Answer;
}

/**
 * MCP Server request
 */
export interface MCPRequest {
  method: string;
  params: Record<string, unknown>;
  id?: string;
}

/**
 * MCP Server response
 */
export interface MCPResponse<T = unknown> {
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id?: string;
}

// ============================================================================
// API TYPES
// ============================================================================

/**
 * Generic API response
 */
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: Date;
  requestId: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset?: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Error response
 */
export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  path?: string;
}

// ============================================================================
// USER & AUTH TYPES
// ============================================================================

/**
 * User profile
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "analyst" | "viewer";
  avatar?: string;
  createdAt: Date;
  lastLogin?: Date;
}

/**
 * Authentication token
 */
export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number; // seconds
  tokenType: "Bearer";
}

/**
 * Login request
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  user: User;
  token: AuthToken;
}

// ============================================================================
// COMPONENT PROPS TYPES
// ============================================================================

/**
 * Line graph component props
 */
export interface LineGraphProps {
  title: string;
  data: CirculationDataPoint[];
  lineColor: string;
  backgroundColor?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  height?: number;
  width?: number;
  onDataPointClick?: (data: CirculationDataPoint) => void;
}

/**
 * Quick access card props
 */
export interface QuickAccessCardProps {
  icon: string;
  title: string;
  description: string;
  color: "blue" | "green" | "orange";
  onClick: () => void;
}

/**
 * Questions input component props
 */
export interface QuestionsInputProps {
  onSubmit: (question: string) => Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  maxLength?: number;
  suggestedQuestions?: string[];
}

/**
 * Stat card props
 */
export interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  trend?: "up" | "down";
  trendValue?: number;
}

// ============================================================================
// SETTINGS & CONFIG TYPES
// ============================================================================

/**
 * Application configuration
 */
export interface AppConfig {
  appName: string;
  version: string;
  apiUrl: string;
  mcpServerUrl: string;
  environment: "development" | "staging" | "production";
  features: {
    uploadEnabled: boolean;
    mcpServerEnabled: boolean;
    cacheEnabled: boolean;
    offlineMode: boolean;
  };
}

/**
 * User preferences
 */
export interface UserPreferences {
  theme: "light" | "dark" | "auto";
  language: string;
  defaultTimeRange: {
    months: number;
  };
  notifications: {
    email: boolean;
    push: boolean;
  };
  privacy: {
    shareAnalytics: boolean;
    shareUsageData: boolean;
  };
}

/**
 * Cache entry
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiresAt: Date;
  tags?: string[];
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

/**
 * Export format type
 */
export type ExportFormat = "csv" | "excel" | "pdf" | "json";

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  includeMetadata: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  categories?: string[];
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  fileName: string;
  size: number; // bytes
  format: ExportFormat;
  downloadUrl?: string;
  expiresAt?: Date;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

/**
 * Notification
 */
export interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  duration?: number; // milliseconds
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Async request state
 */
export interface AsyncRequestState<T> {
  loading: boolean;
  data?: T;
  error?: Error;
  timestamp?: Date;
}

/**
 * Form field state
 */
export interface FormField<T> {
  value: T;
  error?: string;
  touched: boolean;
  dirty: boolean;
}

/**
 * Form state
 */
export interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isDirty: boolean;
  isValid: boolean;
  isSubmitting: boolean;
}
