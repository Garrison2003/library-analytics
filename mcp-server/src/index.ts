import "dotenv/config";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, logger, answerQuestion } from "./server.js";
import { randomUUID } from "node:crypto";

const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.post("/mcp", async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error("MCP request error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  } finally {
    await transport.close();
  }
});

app.post("/questions/ask", async (req, res) => {
  const { query } = req.body as { query?: string };

  if (!query || typeof query !== "string" || !query.trim()) {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_REQUEST", message: "query is required" },
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
    });
    return;
  }

  try {
    const answer = await answerQuestion(query.trim());
    res.json({
      success: true,
      data: answer,
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
    });
  } catch (error) {
    logger.error({ err: error }, "Questions ask error");
    res.status(500).json({
      success: false,
      error: { code: "AI_ERROR", message: error instanceof Error ? error.message : String(error) },
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
    });
  }
});

app.get("/", (_req, res) => {
  res.json({ name: "Library Analytics MCP Server", version: "1.0.0", status: "running" });
});

export default app;

// Start local HTTP server only outside Lambda
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    logger.info(`MCP HTTP server running on port ${PORT}`);
  });
}
