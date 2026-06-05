import "dotenv/config";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, logger } from "./server.js";

const app = express();
app.use(express.json());

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

app.get("/", (_req, res) => {
  res.json({ name: "Library Analytics MCP Server", version: "1.0.0", status: "running" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`MCP HTTP server running on port ${PORT}`);
});

export default app;
