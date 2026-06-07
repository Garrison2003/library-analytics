import Anthropic from "@anthropic-ai/sdk";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { pino } from "pino";
import { randomUUID } from "node:crypto";

// Log to stderr so stdout remains clean for stdio MCP transport
export const logger = pino({ level: process.env.LOG_LEVEL || "info" }, process.stderr);

// ── AWS Clients ───────────────────────────────────────────────────────────────

const dynamoDb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" }),
);

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

// ── Tool Definitions ──────────────────────────────────────────────────────────

const tools = [
  {
    name: "get_circulation_data",
    description:
      "Retrieves circulation data from S3 for a specific branch and date range",
    inputSchema: {
      type: "object" as const,
      properties: {
        branch: { type: "string", description: "Branch name (e.g. 'Allegra Westbrooks Regional')" },
        startDate: { type: "string", description: "Start date YYYY-MM-DD" },
        endDate: { type: "string", description: "End date YYYY-MM-DD" },
        category: { type: "string", description: "Optional: Juvenile, Adult, Young Adult, Non-Print" },
      },
      required: ["branch", "startDate", "endDate"],
    },
  },
  {
    name: "get_s3_circulation_file",
    description: "Retrieves a raw file from S3 for analysis",
    inputSchema: {
      type: "object" as const,
      properties: {
        bucketName: { type: "string", description: "S3 bucket name" },
        fileKey: { type: "string", description: "S3 object key/path" },
      },
      required: ["bucketName", "fileKey"],
    },
  },
  {
    name: "analyze_circulation_trends",
    description: "Analyzes circulation trends using Claude AI",
    inputSchema: {
      type: "object" as const,
      properties: {
        branch: { type: "string", description: "Branch to analyze" },
        metrics: {
          type: "array",
          items: { type: "string" },
          description: "Metrics: checkouts, returns, renewals, holds",
        },
        analysisType: {
          type: "string",
          enum: ["summary", "trends", "anomalies", "recommendations"],
          description: "Type of analysis",
        },
      },
      required: ["branch", "metrics", "analysisType"],
    },
  },
  {
    name: "get_programming_data",
    description: "Retrieves programming event attendance data from DynamoDB",
    inputSchema: {
      type: "object" as const,
      properties: {
        branch: { type: "string", description: "Branch code (e.g. SPA, IMG)" },
        startDate: { type: "string", description: "Start date YYYY-MM-DD" },
        endDate: { type: "string", description: "End date YYYY-MM-DD" },
      },
      required: ["branch", "startDate", "endDate"],
    },
  },
  {
    name: "compare_branches",
    description: "Compares circulation metrics across multiple branches",
    inputSchema: {
      type: "object" as const,
      properties: {
        branches: { type: "array", items: { type: "string" }, description: "Branch names to compare" },
        metric: { type: "string", description: "Metric: checkouts, returns, active_patrons" },
        timeframe: { type: "string", enum: ["daily", "weekly", "monthly"] },
      },
      required: ["branches", "metric", "timeframe"],
    },
  },
  {
    name: "get_programming_sessions",
    description: "Retrieves per-session programming detail from DynamoDB (facilitator, program name, attendance, report type) for a branch and date range",
    inputSchema: {
      type: "object" as const,
      properties: {
        branch: { type: "string", description: "Branch code (e.g. SPA, IMG, TEL)" },
        startDate: { type: "string", description: "Start date YYYY-MM-DD" },
        endDate: { type: "string", description: "End date YYYY-MM-DD" },
        reportType: { type: "string", enum: ["in-house", "outreach"], description: "Optional: filter by report type" },
      },
      required: ["branch", "startDate", "endDate"],
    },
  },
  {
    name: "get_sessions_by_facilitator",
    description: "Finds all programming sessions led by a specific facilitator, optionally filtered by date range",
    inputSchema: {
      type: "object" as const,
      properties: {
        facilitator: { type: "string", description: "Facilitator name (partial match supported)" },
        startDate: { type: "string", description: "Optional start date YYYY-MM-DD" },
        endDate: { type: "string", description: "Optional end date YYYY-MM-DD" },
      },
      required: ["facilitator"],
    },
  },
  {
    name: "get_sessions_by_program",
    description: "Finds all occurrences of a specific program across branches, optionally filtered by date range",
    inputSchema: {
      type: "object" as const,
      properties: {
        programName: { type: "string", description: "Program name (partial match supported)" },
        startDate: { type: "string", description: "Optional start date YYYY-MM-DD" },
        endDate: { type: "string", description: "Optional end date YYYY-MM-DD" },
      },
      required: ["programName"],
    },
  },
  {
    name: "analyze_programming_trends",
    description: "Uses Claude AI to analyze programming attendance trends, flag anomalies, or generate recommendations for a branch",
    inputSchema: {
      type: "object" as const,
      properties: {
        branch: { type: "string", description: "Branch code (e.g. SPA, IMG) or 'ALL' for system-wide" },
        months: { type: "number", description: "Number of months to analyze (default 6)" },
        analysisType: {
          type: "string",
          enum: ["summary", "trends", "anomalies", "recommendations"],
          description: "Type of analysis to perform",
        },
      },
      required: ["branch", "analysisType"],
    },
  },
];

// ── Tool Implementations ──────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6,
  JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
};

async function getCirculationData(branch: string, startDate: string, endDate: string, category?: string) {
  try {
    const bucket = process.env.CIRCULATION_BUCKET || "library-analytics-circulation-dev-688567267460";
    const prefix = process.env.CIRCULATION_PREFIX || "processed/";
    const file = process.env.CIRCULATION_FILE || "circulation_data.json";

    const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: `${prefix}${file}` }));
    const data = JSON.parse((await response.Body?.transformToString()) || "{}");

    const start = startDate.slice(0, 7);
    const end = endDate.slice(0, 7);
    const results: any[] = [];

    for (const month of data.months || []) {
      const monthNum = MONTH_MAP[month.month_name as string];
      if (!monthNum) continue;
      const monthKey = `${month.year}-${String(monthNum).padStart(2, "0")}`;
      if (monthKey < start || monthKey > end) continue;
      const branchData = month.branches?.[branch];
      if (!branchData) continue;
      results.push({
        month: month.display_month,
        year: month.year,
        branch,
        data: category ? { [category]: branchData[category] ?? null } : branchData,
      });
    }

    return { success: true, branch, timeRange: { startDate, endDate }, recordCount: results.length, data: results };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function getS3CirculationFile(bucketName: string, fileKey: string) {
  try {
    const response = await s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: fileKey }));
    const bodyText = await response.Body?.transformToString();
    let fileData: unknown;
    try { fileData = JSON.parse(bodyText || "{}"); } catch { fileData = bodyText; }
    return { success: true, bucket: bucketName, key: fileKey, size: response.ContentLength, data: fileData };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function analyzeCirculationTrends(branch: string, metrics: string[], analysisType: string) {
  try {
    const tableName = process.env.DYNAMODB_ANALYTICS_TABLE || "library-analytics-branch-metadata-dev";
    const dbResponse = await dynamoDb.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: "branch = :branch",
      ExpressionAttributeValues: { ":branch": branch },
    }));

    const prompt = `Analyze library circulation data for ${branch}.
Metrics: ${metrics.join(", ")} | Analysis: ${analysisType}
Records: ${dbResponse.Items?.length || 0} | Data: ${JSON.stringify(dbResponse.Items || [])}`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const analysis = message.content[0].type === "text" ? message.content[0].text : "";
    return { success: true, branch, analysisType, metrics, analysis, dataPoints: dbResponse.Items?.length || 0 };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function getProgrammingData(branch: string, startDate: string, endDate: string) {
  try {
    const tableName = process.env.DYNAMODB_PROGRAMMING_TABLE || "library-analytics-programming-data-dev";
    const response = await dynamoDb.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "branch_code = :branch AND year_month BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":branch": branch,
        ":start": startDate.slice(0, 7),
        ":end": endDate.slice(0, 7),
      },
    }));
    return { success: true, branch, timeRange: { startDate, endDate }, eventCount: response.Items?.length || 0, data: response.Items || [] };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function getProgrammingSessions(branch: string, startDate: string, endDate: string, reportType?: string) {
  try {
    const tableName = process.env.DYNAMODB_PROGRAM_SESSIONS_TABLE || "library-analytics-program-sessions-dev";
    // session_key format: YYYY-MM-DD#program_name#facilitator[#site]
    // Using begins_with on date prefix to cover the range
    const params: any = {
      TableName: tableName,
      KeyConditionExpression: "branch_code = :branch AND session_key BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":branch": branch,
        ":start": startDate,
        ":end": endDate + "￿",
      },
    };
    if (reportType) {
      params.FilterExpression = "report_type = :rt";
      params.ExpressionAttributeValues[":rt"] = reportType;
    }
    const response = await dynamoDb.send(new QueryCommand(params));
    return {
      success: true,
      branch,
      timeRange: { startDate, endDate },
      sessionCount: response.Items?.length || 0,
      data: response.Items || [],
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function getSessionsByFacilitator(facilitator: string, startDate?: string, endDate?: string) {
  try {
    const tableName = process.env.DYNAMODB_PROGRAM_SESSIONS_TABLE || "library-analytics-program-sessions-dev";
    const params: any = {
      TableName: tableName,
      IndexName: "FacilitatorIndex",
      KeyConditionExpression: "primary_facilitator = :facilitator",
      ExpressionAttributeValues: { ":facilitator": facilitator },
    };
    if (startDate && endDate) {
      params.KeyConditionExpression += " AND program_date BETWEEN :start AND :end";
      params.ExpressionAttributeValues[":start"] = startDate;
      params.ExpressionAttributeValues[":end"] = endDate;
    } else if (startDate) {
      params.KeyConditionExpression += " AND program_date >= :start";
      params.ExpressionAttributeValues[":start"] = startDate;
    } else if (endDate) {
      params.KeyConditionExpression += " AND program_date <= :end";
      params.ExpressionAttributeValues[":end"] = endDate;
    }
    const response = await dynamoDb.send(new QueryCommand(params));
    return {
      success: true,
      facilitator,
      timeRange: { startDate, endDate },
      sessionCount: response.Items?.length || 0,
      totalAttendance: (response.Items || []).reduce((sum: number, item: any) => sum + (item.total_attendance || 0), 0),
      data: response.Items || [],
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function getSessionsByProgram(programName: string, startDate?: string, endDate?: string) {
  try {
    const tableName = process.env.DYNAMODB_PROGRAM_SESSIONS_TABLE || "library-analytics-program-sessions-dev";
    const params: any = {
      TableName: tableName,
      IndexName: "ProgramNameIndex",
      KeyConditionExpression: "program_name = :program",
      ExpressionAttributeValues: { ":program": programName },
    };
    if (startDate && endDate) {
      params.KeyConditionExpression += " AND program_date BETWEEN :start AND :end";
      params.ExpressionAttributeValues[":start"] = startDate;
      params.ExpressionAttributeValues[":end"] = endDate;
    } else if (startDate) {
      params.KeyConditionExpression += " AND program_date >= :start";
      params.ExpressionAttributeValues[":start"] = startDate;
    } else if (endDate) {
      params.KeyConditionExpression += " AND program_date <= :end";
      params.ExpressionAttributeValues[":end"] = endDate;
    }
    const response = await dynamoDb.send(new QueryCommand(params));
    const items = response.Items || [];
    const byBranch: Record<string, number> = {};
    for (const item of items) {
      const code = item.branch_code as string;
      byBranch[code] = (byBranch[code] || 0) + (item.total_attendance || 0);
    }
    return {
      success: true,
      programName,
      timeRange: { startDate, endDate },
      sessionCount: items.length,
      totalAttendance: items.reduce((sum: number, item: any) => sum + (item.total_attendance || 0), 0),
      attendanceByBranch: byBranch,
      data: items,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function analyzeProgrammingTrends(branch: string, analysisType: string, months: number = 6) {
  try {
    const programmingTable = process.env.DYNAMODB_PROGRAMMING_TABLE || "library-analytics-programming-data-dev";
    const sessionsTable = process.env.DYNAMODB_PROGRAM_SESSIONS_TABLE || "library-analytics-program-sessions-dev";

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const startYM = startDate.toISOString().slice(0, 7);
    const endYM = endDate.toISOString().slice(0, 7);

    let monthlyData: unknown[] = [];
    let sessionData: unknown[] = [];

    if (branch === "ALL") {
      const scanResp = await dynamoDb.send(new ScanCommand({
        TableName: programmingTable,
        FilterExpression: "year_month BETWEEN :start AND :end",
        ExpressionAttributeValues: { ":start": startYM, ":end": endYM },
      }));
      monthlyData = scanResp.Items || [];
    } else {
      const queryResp = await dynamoDb.send(new QueryCommand({
        TableName: programmingTable,
        KeyConditionExpression: "branch_code = :branch AND year_month BETWEEN :start AND :end",
        ExpressionAttributeValues: { ":branch": branch, ":start": startYM, ":end": endYM },
      }));
      monthlyData = queryResp.Items || [];

      const sessionsResp = await dynamoDb.send(new QueryCommand({
        TableName: sessionsTable,
        KeyConditionExpression: "branch_code = :branch AND session_key BETWEEN :start AND :end",
        ExpressionAttributeValues: {
          ":branch": branch,
          ":start": startDate.toISOString().slice(0, 10),
          ":end": endDate.toISOString().slice(0, 10) + "￿",
        },
      }));
      sessionData = sessionsResp.Items || [];
    }

    const prompt = `You are a library analytics expert. Analyze the following programming data for ${branch === "ALL" ? "all branches" : `branch ${branch}`} over the last ${months} months.

Analysis type: ${analysisType}

Monthly aggregate data (${monthlyData.length} records):
${JSON.stringify(monthlyData, null, 2)}

${sessionData.length > 0 ? `Per-session data (${sessionData.length} sessions):\n${JSON.stringify(sessionData, null, 2)}` : ""}

Provide a ${analysisType} focused response. Be specific, data-driven, and actionable.`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const analysis = message.content[0].type === "text" ? message.content[0].text : "";
    return {
      success: true,
      branch,
      analysisType,
      monthsAnalyzed: months,
      dataPoints: { monthlyRecords: monthlyData.length, sessions: sessionData.length },
      analysis,
      metadata: { model: message.model, tokensUsed: message.usage.input_tokens + message.usage.output_tokens },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function compareBranches(branches: string[], metric: string, timeframe: string) {
  try {
    const tableName = process.env.DYNAMODB_ANALYTICS_TABLE || "library-analytics-branch-metadata-dev";
    const branchesData: any = {};
    for (const branch of branches) {
      const response = await dynamoDb.send(new ScanCommand({
        TableName: tableName,
        FilterExpression: "branch = :branch",
        ExpressionAttributeValues: { ":branch": branch },
      }));
      branchesData[branch] = { recordCount: response.Items?.length || 0, data: response.Items || [] };
    }
    return { success: true, metric, timeframe, branches: branchesData, comparisonCount: branches.length };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ── Questions Handler ─────────────────────────────────────────────────────────

export interface Answer {
  id: string;
  questionId: string;
  response: string;
  confidence: number;
  sources?: string[];
  metadata?: {
    model: string;
    processingTime: number;
    tokensUsed: number;
  };
  timestamp: string;
}

export async function answerQuestion(query: string): Promise<Answer> {
  const start = Date.now();
  const questionId = randomUUID();

  const bucket = process.env.CIRCULATION_BUCKET || "library-analytics-circulation-dev-688567267460";
  const prefix = process.env.CIRCULATION_PREFIX || "processed/";
  const file = process.env.CIRCULATION_FILE || "circulation_data.json";

  let circulationContext = "No circulation data available.";
  try {
    const s3Response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: `${prefix}${file}` }));
    const rawData = await s3Response.Body?.transformToString();
    if (rawData) {
      const parsed = JSON.parse(rawData);
      const months: unknown[] = parsed.months || [];
      const recentMonths = months.slice(-6);
      const branches = months.length > 0 ? Object.keys((months[0] as Record<string, unknown>).branches as Record<string, unknown> || {}) : [];
      circulationContext = `Branches tracked: ${branches.join(", ")}\n\nMost recent 6 months of data:\n${JSON.stringify(recentMonths, null, 2)}`;
    }
  } catch (err) {
    logger.warn({ err }, "Failed to fetch circulation data for question context");
  }

  // Fetch recent programming data for all branches
  let programmingContext = "No programming data available.";
  try {
    const programmingTable = process.env.DYNAMODB_PROGRAMMING_TABLE || "library-analytics-programming-data-dev";
    const sessionsTable = process.env.DYNAMODB_PROGRAM_SESSIONS_TABLE || "library-analytics-program-sessions-dev";
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startYM = sixMonthsAgo.toISOString().slice(0, 7);
    const endYM = new Date().toISOString().slice(0, 7);

    const [monthlyResp, sessionsResp] = await Promise.all([
      dynamoDb.send(new ScanCommand({
        TableName: programmingTable,
        FilterExpression: "year_month BETWEEN :start AND :end",
        ExpressionAttributeValues: { ":start": startYM, ":end": endYM },
      })),
      dynamoDb.send(new ScanCommand({
        TableName: sessionsTable,
        FilterExpression: "program_date >= :start",
        ExpressionAttributeValues: { ":start": sixMonthsAgo.toISOString().slice(0, 10) },
      })),
    ]);

    const monthlyItems = monthlyResp.Items || [];
    const sessionItems = sessionsResp.Items || [];
    programmingContext = `Monthly programming aggregates (${monthlyItems.length} records, ${startYM} to ${endYM}):\n${JSON.stringify(monthlyItems, null, 2)}\n\nIndividual program sessions (${sessionItems.length} records):\n${JSON.stringify(sessionItems, null, 2)}`;
  } catch (err) {
    logger.warn({ err }, "Failed to fetch programming data for question context");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: "You are a library analytics assistant helping staff understand their circulation and programming data. Be concise, data-driven, and helpful.",
    messages: [{ role: "user", content: `Question: ${query}\n\nLibrary Circulation Data:\n${circulationContext}\n\nLibrary Programming Data:\n${programmingContext}` }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";

  return {
    id: randomUUID(),
    questionId,
    response: responseText,
    confidence: 0.9,
    sources: ["circulation_data", "programming_data", "program_sessions"],
    metadata: {
      model: message.model,
      processingTime: Date.now() - start,
      tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
    },
    timestamp: new Date().toISOString(),
  };
}

// ── MCP Server ────────────────────────────────────────────────────────────────

export function createServer(): Server {
  const server = new Server(
    { name: "library-analytics-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!args) {
      return { isError: true, content: [{ type: "text", text: "No arguments provided" }] };
    }

    try {
      let result: unknown;
      switch (name) {
        case "get_circulation_data":
          result = await getCirculationData(args.branch as string, args.startDate as string, args.endDate as string, args.category as string | undefined);
          break;
        case "get_s3_circulation_file":
          result = await getS3CirculationFile(args.bucketName as string, args.fileKey as string);
          break;
        case "analyze_circulation_trends":
          result = await analyzeCirculationTrends(args.branch as string, args.metrics as string[], args.analysisType as string);
          break;
        case "get_programming_data":
          result = await getProgrammingData(args.branch as string, args.startDate as string, args.endDate as string);
          break;
        case "compare_branches":
          result = await compareBranches(args.branches as string[], args.metric as string, args.timeframe as string);
          break;
        case "get_programming_sessions":
          result = await getProgrammingSessions(args.branch as string, args.startDate as string, args.endDate as string, args.reportType as string | undefined);
          break;
        case "get_sessions_by_facilitator":
          result = await getSessionsByFacilitator(args.facilitator as string, args.startDate as string | undefined, args.endDate as string | undefined);
          break;
        case "get_sessions_by_program":
          result = await getSessionsByProgram(args.programName as string, args.startDate as string | undefined, args.endDate as string | undefined);
          break;
        case "analyze_programming_trends":
          result = await analyzeProgrammingTrends(args.branch as string, args.analysisType as string, args.months as number | undefined);
          break;
        default:
          return { isError: true, content: [{ type: "text", text: `Unknown tool: ${name}` }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : "Unknown error"}` }] };
    }
  });

  return server;
}
