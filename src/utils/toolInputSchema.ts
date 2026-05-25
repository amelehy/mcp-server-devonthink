// @ts-nocheck — zodToJsonSchema typings exceed TS recursion limits (TS2589) when checked.
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";

/** MCP tool input schema type without re-inferring the full ToolSchema (avoids TS2589 / OOM). */
export type McpToolInputSchema = Tool["inputSchema"];

/**
 * Convert a Zod schema to MCP JSON Schema. Uses a shallow cast so TypeScript does not
 * deeply instantiate ToolSchema + zod-to-json-schema (which hangs or OOMs on compile).
 */
const zodSchemaToJson = zodToJsonSchema as (schema: z.ZodTypeAny) => unknown;

export function toToolInputSchema(schema: z.ZodTypeAny): McpToolInputSchema {
	return zodSchemaToJson(schema) as McpToolInputSchema;
}
