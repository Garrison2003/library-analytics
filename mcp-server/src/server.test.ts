import { describe, it, expect, vi, beforeEach } from "vitest";

// ── AWS SDK mocks ─────────────────────────────────────────────────────────────

// vi.mock factories are hoisted before variable declarations, so mockSend must
// be declared with vi.hoisted to be accessible inside the factory closures.
const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: mockSend })) },
  QueryCommand: vi.fn((params) => ({ input: params })),
  ScanCommand: vi.fn((params) => ({ input: params })),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send: mockSend })),
  GetObjectCommand: vi.fn((params) => ({ input: params })),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Mock analysis result" }],
      }),
    },
  })),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { createServer } from "./server.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCallToolRequest(name: string, args: Record<string, unknown>) {
  return {
    method: "tools/call" as const,
    params: { name, arguments: args },
  };
}

function makeListToolsRequest() {
  return { method: "tools/list" as const, params: {} };
}

async function callTool(server: ReturnType<typeof createServer>, name: string, args: Record<string, unknown>) {
  // Access the internal handler via a test helper approach using the MCP SDK
  const handlers = (server as any)._requestHandlers;
  const callHandler = handlers?.get("tools/call");
  if (!callHandler) throw new Error("tools/call handler not registered");
  return callHandler(makeCallToolRequest(name, args), {});
}

async function listTools(server: ReturnType<typeof createServer>) {
  const handlers = (server as any)._requestHandlers;
  const listHandler = handlers?.get("tools/list");
  if (!listHandler) throw new Error("tools/list handler not registered");
  return listHandler(makeListToolsRequest(), {});
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createServer", () => {
  it("returns a server instance", () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  it("creates a fresh independent server each call", () => {
    const s1 = createServer();
    const s2 = createServer();
    expect(s1).not.toBe(s2);
  });
});

describe("tools/list", () => {
  let server: ReturnType<typeof createServer>;

  beforeEach(() => {
    server = createServer();
  });

  it("returns all nine tools", async () => {
    const result = await listTools(server);
    expect(result.tools).toHaveLength(9);
  });

  it("includes get_circulation_data", async () => {
    const result = await listTools(server);
    const names = result.tools.map((t: any) => t.name);
    expect(names).toContain("get_circulation_data");
  });

  it("includes get_s3_circulation_file", async () => {
    const result = await listTools(server);
    const names = result.tools.map((t: any) => t.name);
    expect(names).toContain("get_s3_circulation_file");
  });

  it("includes analyze_circulation_trends", async () => {
    const result = await listTools(server);
    const names = result.tools.map((t: any) => t.name);
    expect(names).toContain("analyze_circulation_trends");
  });

  it("includes get_programming_data", async () => {
    const result = await listTools(server);
    const names = result.tools.map((t: any) => t.name);
    expect(names).toContain("get_programming_data");
  });

  it("includes compare_branches", async () => {
    const result = await listTools(server);
    const names = result.tools.map((t: any) => t.name);
    expect(names).toContain("compare_branches");
  });

  it("each tool has a name, description, and inputSchema", async () => {
    const result = await listTools(server);
    for (const tool of result.tools) {
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("inputSchema");
    }
  });
});

describe("tools/call — routing", () => {
  let server: ReturnType<typeof createServer>;

  beforeEach(() => {
    server = createServer();
    mockSend.mockReset();
  });

  it("returns isError for an unknown tool name", async () => {
    const result = await callTool(server, "nonexistent_tool", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/unknown tool/i);
  });

  it("returns isError when arguments are missing", async () => {
    const handlers = (server as any)._requestHandlers;
    const callHandler = handlers?.get("tools/call");
    const result = await callHandler({ method: "tools/call" as const, params: { name: "get_circulation_data", arguments: undefined } }, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/no arguments/i);
  });
});

describe("tools/call — get_circulation_data", () => {
  let server: ReturnType<typeof createServer>;

  beforeEach(() => {
    server = createServer();
    mockSend.mockReset();
  });

  it("returns success:true when S3 returns valid circulation data", async () => {
    const circulationData = {
      months: [
        { month_name: "APRIL", year: 2026, display_month: "Apr 2026", branches: { "Main": { Juvenile: { total: 100 } } } },
      ],
    };
    mockSend.mockResolvedValueOnce({
      Body: { transformToString: async () => JSON.stringify(circulationData) },
    });

    const result = await callTool(server, "get_circulation_data", {
      branch: "Main",
      startDate: "2026-04-01",
      endDate: "2026-04-30",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
  });

  it("returns success:false when S3 throws", async () => {
    mockSend.mockRejectedValueOnce(new Error("S3 unavailable"));

    const result = await callTool(server, "get_circulation_data", {
      branch: "Main",
      startDate: "2026-01-01",
      endDate: "2026-04-30",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/S3 unavailable/);
  });

  it("filters by date range", async () => {
    const circulationData = {
      months: [
        { month_name: "JANUARY", year: 2026, display_month: "Jan 2026", branches: { "Main": {} } },
        { month_name: "APRIL", year: 2026, display_month: "Apr 2026", branches: { "Main": {} } },
      ],
    };
    mockSend.mockResolvedValueOnce({
      Body: { transformToString: async () => JSON.stringify(circulationData) },
    });

    const result = await callTool(server, "get_circulation_data", {
      branch: "Main",
      startDate: "2026-04-01",
      endDate: "2026-04-30",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.recordCount).toBe(1);
  });
});

describe("tools/call — get_s3_circulation_file", () => {
  let server: ReturnType<typeof createServer>;

  beforeEach(() => {
    server = createServer();
    mockSend.mockReset();
  });

  it("returns the file contents on success", async () => {
    mockSend.mockResolvedValueOnce({
      Body: { transformToString: async () => JSON.stringify({ data: "test" }) },
      ContentLength: 20,
    });

    const result = await callTool(server, "get_s3_circulation_file", {
      bucketName: "my-bucket",
      fileKey: "processed/data.json",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.bucket).toBe("my-bucket");
  });

  it("returns success:false on S3 error", async () => {
    mockSend.mockRejectedValueOnce(new Error("NoSuchKey"));

    const result = await callTool(server, "get_s3_circulation_file", {
      bucketName: "my-bucket",
      fileKey: "missing.json",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
  });
});

describe("tools/call — get_programming_data", () => {
  let server: ReturnType<typeof createServer>;

  beforeEach(() => {
    server = createServer();
    mockSend.mockReset();
  });

  it("returns success:true with DynamoDB items", async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        { branch_code: "SPA", year_month: "2026-04", attendance: 4389, programs: 69 },
      ],
    });

    const result = await callTool(server, "get_programming_data", {
      branch: "SPA",
      startDate: "2026-04-01",
      endDate: "2026-04-30",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.eventCount).toBe(1);
  });

  it("returns success:false on DynamoDB error", async () => {
    mockSend.mockRejectedValueOnce(new Error("DynamoDB error"));

    const result = await callTool(server, "get_programming_data", {
      branch: "SPA",
      startDate: "2026-04-01",
      endDate: "2026-04-30",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
  });
});

describe("tools/call — compare_branches", () => {
  let server: ReturnType<typeof createServer>;

  beforeEach(() => {
    server = createServer();
    mockSend.mockReset();
  });

  it("returns data for each requested branch", async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [{ branch: "Main" }] })
      .mockResolvedValueOnce({ Items: [{ branch: "Imaginon" }, { branch: "Imaginon" }] });

    const result = await callTool(server, "compare_branches", {
      branches: ["Main", "Imaginon"],
      metric: "checkouts",
      timeframe: "monthly",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.comparisonCount).toBe(2);
    expect(parsed.branches).toHaveProperty("Main");
    expect(parsed.branches).toHaveProperty("Imaginon");
  });
});

describe("tools/call — analyze_circulation_trends", () => {
  let server: ReturnType<typeof createServer>;

  beforeEach(() => {
    server = createServer();
    mockSend.mockReset();
  });

  it("returns an analysis string from Claude", async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });

    const result = await callTool(server, "analyze_circulation_trends", {
      branch: "Main",
      metrics: ["checkouts"],
      analysisType: "summary",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(typeof parsed.analysis).toBe("string");
    expect(parsed.analysis.length).toBeGreaterThan(0);
  });
});
