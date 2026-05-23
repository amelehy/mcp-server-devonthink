import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import { executeJxa } from "../applescript/execute.js";
import { JXA_DEVONTHINK_APP } from "../constants.js";
const ToolInputSchema = ToolSchema.shape.inputSchema;
const IsRunningSchema = z.object({}).strict();
const isRunning = async () => {
    const script = `
    const app = ${JXA_DEVONTHINK_APP};
    const isRunning = app.running();
    JSON.stringify({ isRunning });
  `;
    return await executeJxa(script);
};
export const isRunningTool = {
    name: "is_running",
    description: "Check if the DEVONthink application is currently running.\n\nExample:\n{}",
    inputSchema: zodToJsonSchema(IsRunningSchema),
    run: isRunning,
};
