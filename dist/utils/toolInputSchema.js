import { zodToJsonSchema } from "zod-to-json-schema";
/**
 * Convert a Zod schema to MCP JSON Schema. Uses a shallow cast so TypeScript does not
 * deeply instantiate ToolSchema + zod-to-json-schema (which hangs or OOMs on compile).
 */
const zodSchemaToJson = zodToJsonSchema;
export function toToolInputSchema(schema) {
    return zodSchemaToJson(schema);
}
