// src/services/api.ts
import type {
  APIResponse,
  CirculationData,
  MonthlyAnalytics,
  DailyAnalytics,
  FileUploadResponse,
  Question,
  Answer,
} from "../types/index";

/**
 * API Service
 *
 * Handles all HTTP requests to the backend API
 */
class APIService {
  private baseURL: string;
  private timeout: number = 30000; // 30 seconds

  constructor(
    baseURL: string = import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  ) {
    this.baseURL = baseURL;
  }

  /**
   * Generic fetch wrapper with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `HTTP Error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("API Request Error:", error);
      throw error;
    }
  }

  /**
   * Get circulation data for a specific category
   */
  async getCirculationData(
    category?: string,
  ): Promise<APIResponse<CirculationData>> {
    const params = new URLSearchParams();
    if (category) params.append("category", category);

    return this.request<CirculationData>(`/circulation?${params.toString()}`);
  }

  /**
   * Get monthly analytics
   */
  async getMonthlyAnalytics(
    month: string,
    year: number,
  ): Promise<APIResponse<MonthlyAnalytics>> {
    return this.request<MonthlyAnalytics>(
      `/analytics/monthly?month=${month}&year=${year}`,
    );
  }

  /**
   * Get daily analytics
   */
  async getDailyAnalytics(date: string): Promise<APIResponse<DailyAnalytics>> {
    return this.request<DailyAnalytics>(`/analytics/daily?date=${date}`);
  }

  /**
   * Upload file to S3 with type-based routing
   */
  async uploadFile(
    file: File,
    options?: { category?: string; overwrite?: boolean; fileType?: string },
  ): Promise<APIResponse<FileUploadResponse>> {
    const formData = new FormData();
    formData.append("file", file);

    if (options?.category) {
      formData.append("category", options.category);
    }
    if (options?.fileType) {
      formData.append("fileType", options.fileType);
    }
    if (options?.overwrite !== undefined) {
      formData.append("overwrite", String(options.overwrite));
    }

    try {
      const response = await fetch(`${this.baseURL}/upload`, {
        method: "POST",
        body: formData,
        // Don't set Content-Type header - let the browser set it with boundary
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("File Upload Error:", error);
      throw error;
    }
  }

  /**
   * Validate a file without uploading
   */
  async validateFile(
    file: File,
    fileType?: string,
  ): Promise<APIResponse<{ valid: boolean; errors: string[] }>> {
    const formData = new FormData();
    formData.append("file", file);

    if (fileType) {
      formData.append("fileType", fileType);
    }

    try {
      const response = await fetch(`${this.baseURL}/upload/validate`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("File Validation Error:", error);
      throw error;
    }
  }

  /**
   * Submit a question to the API (for MCP server relay)
   */
  async askQuestion(question: string): Promise<APIResponse<Answer>> {
    return this.request<Answer>("/questions/ask", {
      method: "POST",
      body: JSON.stringify({ query: question }),
    });
  }

  /**
   * Get question history
   */
  async getQuestionHistory(
    limit: number = 10,
    offset: number = 0,
  ): Promise<APIResponse<Question[]>> {
    return this.request<Question[]>(
      `/questions/history?limit=${limit}&offset=${offset}`,
    );
  }

  /**
   * Get answer for a specific question
   */
  async getAnswer(questionId: string): Promise<APIResponse<Answer>> {
    return this.request<Answer>(`/questions/${questionId}/answer`);
  }
}

// Export singleton instance
export const apiClient = new APIService();

export default APIService;
