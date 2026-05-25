import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { executeJxa } from "../applescript/execute.js";
import { escapeStringForJXA, isJXASafeString } from "../utils/escapeString.js";
import {
	getRecordLookupHelpers,
	getDatabaseHelper,
	getEditionCompatHelpers,
	getRecordTypeOrKindHelper,
	getRecordTextContentHelper,
} from "../utils/jxaHelpers.js";
import { JXA_DEVONTHINK_APP } from "../constants.js";
import { toToolInputSchema } from "../utils/toolInputSchema.js";

const GetRecordContentSchema = z
	.object({
		uuid: z.string().optional().describe("Record UUID"),
		recordUuid: z.string().optional().describe("Alias for uuid (use the uuid field from search results)"),
		id: z.number().optional().describe("Numeric record id from search results (e.g. 13855)"),
		recordId: z.number().optional().describe("Alias for id"),
		databaseName: z
			.string()
			.optional()
			.describe("Database name (optional, from get_open_databases)"),
		databaseUuid: z
			.string()
			.optional()
			.describe("Database UUID (optional, from get_open_databases)"),
	})
	.strict()
	.refine(
		(data) =>
			data.uuid !== undefined ||
			data.recordUuid !== undefined ||
			data.id !== undefined ||
			data.recordId !== undefined,
		{ message: "Provide uuid, recordUuid, id, or recordId" },
	);

type GetRecordContentInput = z.infer<typeof GetRecordContentSchema>;

interface GetRecordContentResult {
	success: boolean;
	error?: string;
	content?: string;
}

const getRecordContent = async (input: GetRecordContentInput): Promise<GetRecordContentResult> => {
	let resolvedUuid = input.recordUuid ?? input.uuid;
	let resolvedId = input.recordId ?? input.id;

	// Claude often passes numeric id as "uuid" (e.g. "13855")
	if (resolvedUuid && resolvedId === undefined && /^\d+$/.test(resolvedUuid)) {
		resolvedId = Number.parseInt(resolvedUuid, 10);
		resolvedUuid = undefined;
	}

	if (resolvedUuid && !isJXASafeString(resolvedUuid)) {
		return { success: false, error: "UUID contains invalid characters" };
	}
	if (input.databaseName && !isJXASafeString(input.databaseName)) {
		return { success: false, error: "Database name contains invalid characters" };
	}
	if (input.databaseUuid && !isJXASafeString(input.databaseUuid)) {
		return { success: false, error: "Database UUID contains invalid characters" };
	}

	const script = `
    (() => {
      const theApp = ${JXA_DEVONTHINK_APP};
      theApp.includeStandardAdditions = true;
      
      ${getEditionCompatHelpers()}
      ${getRecordLookupHelpers()}
      ${getDatabaseHelper}
      ${getRecordTypeOrKindHelper}
      ${getRecordTextContentHelper}
      
      try {
        const targetDatabase = resolveDatabase(
          theApp,
          ${input.databaseName ? `"${escapeStringForJXA(input.databaseName)}"` : "null"},
          ${input.databaseUuid ? `"${escapeStringForJXA(input.databaseUuid)}"` : "null"}
        );

        const lookupOptions = {
          uuid: ${resolvedUuid ? `"${escapeStringForJXA(resolvedUuid)}"` : "null"},
          id: ${resolvedId !== undefined ? resolvedId : "null"},
          path: null,
          name: null,
          database: targetDatabase
        };
        
        const lookupResult = getRecord(theApp, lookupOptions);
        
        if (!lookupResult.record) {
          let errorDetails = lookupResult.error || "Record not found";
          if (${resolvedId !== undefined ? resolvedId : "null"} !== null) {
            errorDetails = "Record with ID " + ${resolvedId !== undefined ? resolvedId : "null"} + " not found";
          } else if (${resolvedUuid ? `"${escapeStringForJXA(resolvedUuid)}"` : "null"}) {
            errorDetails = "Record with UUID " + (${resolvedUuid ? `"${escapeStringForJXA(resolvedUuid)}"` : "null"} || "unknown") + " not found";
          }
          return JSON.stringify({ success: false, error: errorDetails });
        }
        
        const record = lookupResult.record;
        const pDatabaseName = ${input.databaseName ? `"${escapeStringForJXA(input.databaseName)}"` : "null"};
        const pDatabaseUuid = ${input.databaseUuid ? `"${escapeStringForJXA(input.databaseUuid)}"` : "null"};
        if (pDatabaseName && record.database().name() !== pDatabaseName) {
          return JSON.stringify({
            success: false,
            error: "Record not found in database " + pDatabaseName
          });
        }
        if (pDatabaseUuid && record.database().uuid() !== pDatabaseUuid) {
          return JSON.stringify({
            success: false,
            error: "Record not found in database " + pDatabaseUuid
          });
        }

        const content = getRecordTextContent(record);
        if (content === undefined || content === null) {
          return JSON.stringify({
            success: false,
            error: "No text content available for this record type (" + (getRecordTypeOrKind(record) || "unknown") + ")"
          });
        }
        
        return JSON.stringify({
          success: true,
          content: content
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error.toString()
        });
      }
    })();
  `;

	return await executeJxa<GetRecordContentResult>(script);
};

export const getRecordContentTool: Tool = {
	name: "get_record_content",
	description:
		'Gets the text content of a DEVONthink record. Use uuid from search (not the numeric id unless passing id/recordId). databaseName or databaseUuid optional.\n\nExamples:\n{ "recordUuid": "948A6182-6F3C-486D-8ECA-89B82C3885E4", "databaseName": "DB 1" }\n{ "id": 13855, "databaseUuid": "E58FC61B-A92D-4E47-AD59-E28A5942AB07" }',
	inputSchema: toToolInputSchema(GetRecordContentSchema),
	run: getRecordContent,
};
