import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { executeJxa } from "../applescript/execute.js";
import { JXA_DEVONTHINK_APP } from "../constants.js";
import { toToolInputSchema } from "../utils/toolInputSchema.js";

const IsRunningSchema = z.object({}).strict();

const isRunning = async (): Promise<{ isRunning: boolean }> => {
	const script = `
    const app = ${JXA_DEVONTHINK_APP};
    const isRunning = app.running();
    JSON.stringify({ isRunning });
  `;
	return await executeJxa<{ isRunning: boolean }>(script);
};

export const isRunningTool: Tool = {
	name: "is_running",
	description: "Check if the DEVONthink application is currently running.\n\nExample:\n{}",
	inputSchema: toToolInputSchema(IsRunningSchema),
	run: isRunning,
};
