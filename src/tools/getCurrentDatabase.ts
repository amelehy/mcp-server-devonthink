import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { Tool, ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import { executeJxa } from "../applescript/execute.js";
import { JXA_DEVONTHINK_APP } from "../constants.js";
import { getEditionCompatHelpers } from "../utils/jxaHelpers.js";

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

const GetCurrentDatabaseSchema = z.object({}).strict();

interface DatabaseInfo {
	id: number;
	uuid: string;
	name: string;
	path: string;
	filename: string;
	encrypted: boolean;
	revisionProof?: boolean; // DEVONthink 4.1 and later
	auditProof?: boolean; // DEVONthink before 4.1
	readOnly: boolean;
	spotlightIndexing: boolean;
	versioning: boolean;
	comment?: string;
}

interface GetCurrentDatabaseResult {
	success: boolean;
	error?: string;
	database?: DatabaseInfo;
}

const getCurrentDatabase = async (): Promise<GetCurrentDatabaseResult> => {
	const script = `
    (() => {
      const theApp = ${JXA_DEVONTHINK_APP};
      theApp.includeStandardAdditions = true;
      ${getEditionCompatHelpers()}
      
      try {
        const currentDb = theApp.currentDatabase();
        
        if (!currentDb) {
          return JSON.stringify({
            success: false,
            error: "No current database selected"
          });
        }
        
        const databaseInfo = {
          id: currentDb.id(),
          uuid: currentDb.uuid(),
          name: currentDb.name(),
          path: currentDb.path(),
          filename: currentDb.filename(),
          encrypted: currentDb.encrypted(),
          readOnly: currentDb.readOnly(),
          spotlightIndexing: currentDb.spotlightIndexing(),
          versioning: currentDb.versioning()
        };
        
        applyDatabaseAuditProof(currentDb, databaseInfo);
        applyDatabaseComment(currentDb, databaseInfo);
        
        return JSON.stringify({
          success: true,
          database: databaseInfo
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error.toString()
        });
      }
    })();
  `;

	return await executeJxa<GetCurrentDatabaseResult>(script);
};

export const currentDatabaseTool: Tool = {
	name: "current_database",
	description:
		"Get information about the currently selected database in DEVONthink.\n\nExample:\n{}",
	inputSchema: zodToJsonSchema(GetCurrentDatabaseSchema) as ToolInput,
	run: getCurrentDatabase,
};
