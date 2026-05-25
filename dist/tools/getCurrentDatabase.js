import { z } from "zod";
import { executeJxa } from "../applescript/execute.js";
import { JXA_DEVONTHINK_APP } from "../constants.js";
import { getEditionCompatHelpers } from "../utils/jxaHelpers.js";
import { toToolInputSchema } from "../utils/toolInputSchema.js";
const GetCurrentDatabaseSchema = z.object({}).strict();
const getCurrentDatabase = async () => {
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
          encrypted: currentDb.encrypted(),
          readOnly: currentDb.readOnly()
        };
        
        applyDatabaseOptionalFields(currentDb, databaseInfo);
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
    return await executeJxa(script);
};
export const currentDatabaseTool = {
    name: "current_database",
    description: "Get information about the currently selected database in DEVONthink.\n\nExample:\n{}",
    inputSchema: toToolInputSchema(GetCurrentDatabaseSchema),
    run: getCurrentDatabase,
};
