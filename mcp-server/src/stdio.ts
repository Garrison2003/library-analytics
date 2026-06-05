import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback to .env if .env.local is absent
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, logger } from "./server.js";

const server = createServer();
const transport = new StdioServerTransport();

await server.connect(transport);

logger.info("Library Analytics MCP server running on stdio");

process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});
