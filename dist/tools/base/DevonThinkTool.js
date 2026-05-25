import { executeJxa } from "../../applescript/execute.js";
import { escapeStringForJXA } from "../../utils/escapeString.js";
import { toToolInputSchema } from "../../utils/toolInputSchema.js";
/**
 * Base class for all DEVONthink tools
 */
export class DevonThinkTool {
    constructor(config) {
        this.name = config.name;
        this.description = config.description;
        this.inputSchema = config.inputSchema;
        this.buildScript = config.buildScript;
    }
    /**
     * Get the MCP tool definition
     */
    getTool() {
        return {
            name: this.name,
            description: this.description,
            inputSchema: toToolInputSchema(this.inputSchema),
            run: this.execute.bind(this),
        };
    }
    /**
     * Execute the tool
     */
    async execute(input) {
        // Validate input
        const validatedInput = this.inputSchema.parse(input);
        // Build the script with helpers
        const script = this.buildScript(validatedInput, this.getHelpers());
        // Wrap in IIFE if not already wrapped
        const wrappedScript = script.trim().startsWith("(") ? script : `(() => { ${script} })();`;
        // Execute and return result
        return await executeJxa(wrappedScript);
    }
    /**
     * Get helper functions for script building
     */
    getHelpers() {
        return {
            escapeString: escapeStringForJXA,
            formatValue: this.formatValue.bind(this),
            wrapInTryCatch: this.wrapInTryCatch.bind(this),
            buildDatabaseLookup: this.buildDatabaseLookup.bind(this),
            buildRecordLookup: this.buildRecordLookup.bind(this),
        };
    }
    /**
     * Format a value for use in JXA script
     */
    formatValue(value) {
        if (value === null || value === undefined) {
            return "null";
        }
        if (typeof value === "string") {
            return `"${escapeStringForJXA(value)}"`;
        }
        if (typeof value === "number" || typeof value === "boolean") {
            return String(value);
        }
        if (Array.isArray(value)) {
            return `[${value.map((v) => this.formatValue(v)).join(", ")}]`;
        }
        // For objects, build using bracket notation to avoid JXA issues
        if (typeof value === "object") {
            const lines = ["const obj = {};"];
            for (const [key, val] of Object.entries(value)) {
                lines.push(`obj["${escapeStringForJXA(key)}"] = ${this.formatValue(val)};`);
            }
            return `(function() { ${lines.join(" ")} return obj; })()`;
        }
        return JSON.stringify(value);
    }
    /**
     * Wrap code in try-catch block
     */
    wrapInTryCatch(code, errorHandler) {
        const defaultErrorHandler = `
      const errorResponse = {};
      errorResponse["success"] = false;
      errorResponse["error"] = error.toString();
      return JSON.stringify(errorResponse);
    `;
        return `
      try {
        ${code}
      } catch (error) {
        ${errorHandler || defaultErrorHandler}
      }
    `;
    }
    /**
     * Build database lookup code
     */
    buildDatabaseLookup(databaseName) {
        if (!databaseName) {
            return "const targetDatabase = theApp.currentDatabase();";
        }
        return `
      const databases = theApp.databases();
      const targetDatabase = databases.find(db => db.name() === "${escapeStringForJXA(databaseName)}");
      if (!targetDatabase) {
        throw new Error("Database not found: ${escapeStringForJXA(databaseName)}");
      }
    `;
    }
    /**
     * Build record lookup code
     */
    buildRecordLookup(uuid, id, path, databaseName) {
        const lines = [];
        if (uuid) {
            lines.push(`const record = theApp.getRecordWithUuid("${escapeStringForJXA(uuid)}");`);
            lines.push(`if (!record) throw new Error("Record not found with UUID: ${escapeStringForJXA(uuid)}");`);
        }
        else if (id !== undefined && id !== null) {
            // Need database for ID lookup
            if (databaseName) {
                lines.push(this.buildDatabaseLookup(databaseName));
            }
            else {
                lines.push("const targetDatabase = theApp.currentDatabase();");
            }
            lines.push(`const record = targetDatabase.getRecordWithId(${id});`);
            lines.push(`if (!record) throw new Error("Record not found with ID: ${id}");`);
        }
        else if (path) {
            // Need database for path lookup
            if (databaseName) {
                lines.push(this.buildDatabaseLookup(databaseName));
            }
            else {
                lines.push("const targetDatabase = theApp.currentDatabase();");
            }
            lines.push(`const record = targetDatabase.getRecordAt("${escapeStringForJXA(path)}");`);
            lines.push(`if (!record) throw new Error("Record not found at path: ${escapeStringForJXA(path)}");`);
        }
        else {
            lines.push('throw new Error("No record identifier provided");');
        }
        return lines.join("\n");
    }
}
/**
 * Factory function to create a tool from configuration
 */
export function createDevonThinkTool(config) {
    class ConcreteDevonThinkTool extends DevonThinkTool {
        constructor() {
            super(config);
        }
    }
    const toolInstance = new ConcreteDevonThinkTool();
    return toolInstance.getTool();
}
