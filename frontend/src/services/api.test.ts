import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import APIService, { apiClient } from "./api";

describe("APIService", () => {
  let api: APIService;

  const mockFetch = (data: unknown, ok = true, status = 200) => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok,
      status,
      statusText: ok ? "OK" : "Not Found",
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
      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).not.toContain("category=");
    });
  });

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

  describe("uploadFile", () => {
    it("sends a POST to /upload with the file in FormData", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      });
      const file = new File(["content"], "data.csv", { type: "text/csv" });
      await api.uploadFile(file);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/upload"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("appends category and overwrite options to FormData", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      });
      const file = new File(["content"], "data.csv", { type: "text/csv" });
      await api.uploadFile(file, {
        category: "Juvenile Fiction",
        overwrite: true,
      });
      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = (init as RequestInit).body as FormData;
      expect(body.get("category")).toBe("Juvenile Fiction");
      expect(body.get("overwrite")).toBe("true");
    });

    it("throws when the upload response is not ok", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });
      const file = new File(["content"], "data.csv", { type: "text/csv" });
      await expect(api.uploadFile(file)).rejects.toThrow("Upload failed: 500");
    });
  });

  describe("error handling", () => {
    it("throws on an HTTP error response", async () => {
      mockFetch({}, false, 404);
      await expect(api.getCirculationData()).rejects.toThrow("HTTP Error: 404");
    });

    it("returns the parsed JSON body on success", async () => {
      const payload = { data: [{ id: 1 }], success: true };
      mockFetch(payload);
      const result = await api.getCirculationData();
      expect(result).toEqual(payload);
    });
  });

  describe("apiClient singleton", () => {
    it("exports an APIService instance", () => {
      expect(apiClient).toBeInstanceOf(APIService);
    });
  });
});
