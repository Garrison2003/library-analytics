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

class APIService {
  private baseURL: string;
  private timeout: number = 30000;
  private tokenGetter: (() => Promise<string>) | null = null;

  constructor(
    baseURL: string = import.meta.env.VITE_API_URL ||
      "http://localhost:3000/api",
  ) {
    this.baseURL = baseURL;
  }

  setTokenGetter(fn: () => Promise<string>): void {
    this.tokenGetter = fn;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.tokenGetter) return {};
    const token = await this.tokenGetter();
    return { Authorization: `Bearer ${token}` };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const authHeaders = await this.getAuthHeaders();

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
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

  async getCirculationData(
    category?: string,
  ): Promise<APIResponse<CirculationData>> {
    const params = new URLSearchParams();
    if (category) params.append("category", category);
    return this.request<CirculationData>(`/circulation?${params.toString()}`);
  }

  async getProgrammingData(branch: string, months: number = 12): Promise<APIResponse<any>> {
    const params = new URLSearchParams({ branch, months: String(months) });
    return this.request<any>(`/programming/history?${params.toString()}`);
  }

  async getMonthlyAnalytics(
    month: string,
    year: number,
  ): Promise<APIResponse<MonthlyAnalytics>> {
    return this.request<MonthlyAnalytics>(
      `/analytics/monthly?month=${month}&year=${year}`,
    );
  }

  async getDailyAnalytics(date: string): Promise<APIResponse<DailyAnalytics>> {
    return this.request<DailyAnalytics>(`/analytics/daily?date=${date}`);
  }

  async uploadFile(
    file: File,
    options?: { category?: string; overwrite?: boolean; fileType?: string },
  ): Promise<APIResponse<FileUploadResponse>> {
    const formData = new FormData();
    formData.append("file", file);

    if (options?.category) formData.append("category", options.category);
    if (options?.fileType) formData.append("fileType", options.fileType);
    if (options?.overwrite !== undefined)
      formData.append("overwrite", String(options.overwrite));

    try {
      const authHeaders = await this.getAuthHeaders();

      const response = await fetch(`${this.baseURL}/upload`, {
        method: "POST",
        body: formData,
        headers: authHeaders,
      });

      if (!response.ok && response.status !== 409) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("File Upload Error:", error);
      throw error;
    }
  }

  async validateFile(
    file: File,
    fileType?: string,
  ): Promise<APIResponse<{ valid: boolean; errors: string[] }>> {
    const formData = new FormData();
    formData.append("file", file);
    if (fileType) formData.append("fileType", fileType);

    try {
      const authHeaders = await this.getAuthHeaders();

      const response = await fetch(`${this.baseURL}/upload/validate`, {
        method: "POST",
        body: formData,
        headers: authHeaders,
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

  async askQuestion(question: string): Promise<APIResponse<Answer>> {
    return this.request<Answer>("/questions/ask", {
      method: "POST",
      body: JSON.stringify({ query: question }),
    });
  }

  async getQuestionHistory(
    limit: number = 10,
    offset: number = 0,
  ): Promise<APIResponse<Question[]>> {
    return this.request<Question[]>(
      `/questions/history?limit=${limit}&offset=${offset}`,
    );
  }

  async getAnswer(questionId: string): Promise<APIResponse<Answer>> {
    return this.request<Answer>(`/questions/${questionId}/answer`);
  }
}

export const apiClient = new APIService();

export default APIService;
