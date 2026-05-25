import { z } from "zod";
import { executeJxa } from "../applescript/execute.js";
import { JXA_DEVONTHINK_APP } from "../constants.js";
import { getEditionCompatHelpers } from "../utils/jxaHelpers.js";
import { toToolInputSchema } from "../utils/toolInputSchema.js";
const GetOpenDatabasesSchema = z.object({}).strict();
const getOpenDatabases = async () => {
    const script = `
    (() => {
      const theApp = ${JXA_DEVONTHINK_APP};
      theApp.includeStandardAdditions = true;
      ${getEditionCompatHelpers()}
      
      try {
        const databases = theApp.databases();
        
        if (!databases || databases.length === 0) {
          return JSON.stringify({
            success: true,
            databases: [],
            totalCount: 0
          });
        }
        
        const databaseInfos = databases.map(db => {
          const info = {
            id: db.id(),
            uuid: db.uuid(),
            name: db.name(),
            path: db.path(),
            encrypted: db.encrypted(),
            readOnly: db.readOnly()
          };
          
          applyDatabaseOptionalFields(db, info);
          applyDatabaseAuditProof(db, info);
          applyDatabaseComment(db, info);
          
          return info;
        });
        
        return JSON.stringify({
          success: true,
          databases: databaseInfos,
          totalCount: databases.length
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
export const getOpenDatabasesTool = {
    name: "get_open_databases",
    description: "Get a list of all currently open databases in DEVONthink.\n\nExample:\n{}",
    inputSchema: toToolInputSchema(GetOpenDatabasesSchema),
    run: getOpenDatabases,
};
