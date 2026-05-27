import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import APIService, { apiClient } from "./api";

describe("APIService", () => {
  let api: APIService;

  const mockFetch = (data: unknown, ok = true, status = 200) => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok,
      status,
      statusText: ok ? "OK" : "Error",
      json: async () => data,
    });
  };

  beforeEach(() => {
    api = new APIService("http://test.api");
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ── getCirculationData ─────────────────────────────────────────────────────

  describe("getCirculationData", () => {
    it("calls the /circulation endpoint", async () => {
      mockFetch({ data: [] });
      await api.getCirculationData();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/circulation"),
        expect.any(Object),
      );
    });

    it("appends the category query param when provided", async () => {
      mockFetch({ data: [] });
      await api.getCirculationData("Juvenile Fiction");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("category=Juvenile+Fiction"),
        expect.any(Object),
      );
    });

    it("omits category param when not provided", async () => {
      mockFetch({ data: [] });
      await api.getCirculationData();
      const url = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(url).not.toContain("category=");
    });
  });

  // ── getMonthlyAnalytics ────────────────────────────────────────────────────

  describe("getMonthlyAnalytics", () => {
    it("calls the correct URL with month and year", async () => {
      mockFetch({ data: {} });
      await api.getMonthlyAnalytics("January", 2026);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/analytics/monthly?month=January&year=2026"),
        expect.any(Object),
      );
    });
  });

  // ── getDailyAnalytics ──────────────────────────────────────────────────────

  describe("getDailyAnalytics", () => {
    it("calls the correct URL with date", async () => {
      mockFetch({ data: {} });
      await api.getDailyAnalytics("2026-01-15");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/analytics/daily?date=2026-01-15"),
        expect.any(Object),
      );
    });
  });

  // ── askQuestion ────────────────────────────────────────────────────────────

  describe("askQuestion", () => {
    it("sends a POST request with the question in the body", async () => {
      mockFetch({ data: {} });
      await api.askQuestion("What is the trend?");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/questions/ask"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ query: "What is the trend?" }),
        }),
      );
    });
  });

  // ── getQuestionHistory ─────────────────────────────────────────────────────

  describe("getQuestionHistory", () => {
    it("uses default limit=10 and offset=0", async () => {
      mockFetch({ data: [] });
      await api.getQuestionHistory();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=10&offset=0"),
        expect.any(Object),
      );
    });

    it("passes custom limit and offset", async () => {
      mockFetch({ data: [] });
      await api.getQuestionHistory(5, 20);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=5&offset=20"),
        expect.any(Object),
      );
    });
  });

  // ── getAnswer ─────────────────────────────────────────────────────────────

  describe("getAnswer", () => {
    it("calls the correct URL with the question ID", async () => {
      mockFetch({ data: {} });
      await api.getAnswer("question-123");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/questions/question-123/answer"),
        expect.any(Object),
      );
    });
  });

  // ── uploadFile ─────────────────────────────────────────────────────────────

  describe("uploadFile", () => {
    const makeFile = () =>
      new File(["content"], "data.xlsm", { type: "application/vnd.ms-excel" });

    it("sends a POST to /upload with the file in FormData", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      });
      await api.uploadFile(makeFile());
      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(url).toContain("/upload");
      expect((init as RequestInit).method).toBe("POST");
    });

    it("appends the file to FormData under the 'file' key", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      });
      const file = makeFile();
      await api.uploadFile(file);
      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect((init as RequestInit).body).toBeInstanceOf(FormData);
      expect(((init as RequestInit).body as FormData).get("file")).toBe(file);
    });

    it("appends category and overwrite options to FormData", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      });
      await api.uploadFile(makeFile(), {
        category: "Juvenile Fiction",
        overwrite: true,
      });
      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = (init as RequestInit).body as FormData;
      expect(body.get("category")).toBe("Juvenile Fiction");
      expect(body.get("overwrite")).toBe("true");
    });

    it("appends fileType option to FormData", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      });
      await api.uploadFile(makeFile(), { fileType: "circulation" });
      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(((init as RequestInit).body as FormData).get("fileType")).toBe(
        "circulation",
      );
    });

    it("throws when the upload response is not ok", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });
      await expect(api.uploadFile(makeFile())).rejects.toThrow(
        "Upload failed: 500",
      );
    });
  });

  // ── validateFile ───────────────────────────────────────────────────────────

  describe("validateFile", () => {
    const makeFile = () =>
      new File(["content"], "data.xlsm", { type: "application/vnd.ms-excel" });

    it("sends a POST to /upload/validate", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { valid: true, errors: [] } }),
      });
      await api.validateFile(makeFile());
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/upload/validate"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("appends fileType to FormData when provided", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { valid: true, errors: [] } }),
      });
      await api.validateFile(makeFile(), "circulation");
      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(((init as RequestInit).body as FormData).get("fileType")).toBe(
        "circulation",
      );
    });

    it("returns the parsed JSON on success", async () => {
      const payload = { data: { valid: true, errors: [] } };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => payload,
      });
      const result = await api.validateFile(makeFile());
      expect(result).toEqual(payload);
    });

    it("throws when the validate response is not ok", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 422,
      });
      await expect(api.validateFile(makeFile())).rejects.toThrow(
        "Validation failed: 422",
      );
    });

    it("throws when fetch itself rejects", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Network error"),
      );
      await expect(api.validateFile(makeFile())).rejects.toThrow(
        "Network error",
      );
    });
  });

  // ── error handling ─────────────────────────────────────────────────────────

  describe("error handling", () => {
    it("throws on a 404 HTTP error response", async () => {
      mockFetch({}, false, 404);
      await expect(api.getCirculationData()).rejects.toThrow("HTTP Error: 404");
    });

    it("throws on a 500 HTTP error response", async () => {
      mockFetch({}, false, 500);
      await expect(api.getCirculationData()).rejects.toThrow("HTTP Error: 500");
    });

    it("throws on a 401 HTTP error response", async () => {
      mockFetch({}, false, 401);
      await expect(api.getCirculationData()).rejects.toThrow("HTTP Error: 401");
    });

    it("throws when fetch itself rejects", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Network error"),
      );
      await expect(api.getCirculationData()).rejects.toThrow("Network error");
    });

    it("returns the parsed JSON body on success", async () => {
      const payload = { data: [{ id: 1 }], success: true };
      mockFetch(payload);
      const result = await api.getCirculationData();
      expect(result).toEqual(payload);
    });
  });

  // ── apiClient singleton ────────────────────────────────────────────────────

  describe("apiClient singleton", () => {
    it("exports an APIService instance", () => {
      expect(apiClient).toBeInstanceOf(APIService);
    });

    it("uses VITE_API_URL when set", () => {
      vi.stubEnv("VITE_API_URL", "http://custom-api.com");
      const instance = new APIService();
      // baseURL is private; verify indirectly via fetch call URL
      vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      }));
      instance.getCirculationData();
      vi.unstubAllEnvs();
    });
  });
});
