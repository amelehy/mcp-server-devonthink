import { z } from "zod";
import { executeJxa } from "../applescript/execute.js";
import { escapeStringForJXA, isJXASafeString } from "../utils/escapeString.js";
import { getRecordLookupHelpers } from "../utils/jxaHelpers.js";
import { JXA_DEVONTHINK_APP } from "../constants.js";
import { toToolInputSchema } from "../utils/toolInputSchema.js";
const RemoveTagsSchema = z
    .object({
    uuid: z.string().describe("UUID of the record to remove tags from"),
    tags: z.array(z.string()).describe("Tags to remove"),
    databaseName: z
        .string()
        .optional()
        .describe("Database to remove tags from the record in (optional)"),
})
    .strict();
const removeTags = async (input) => {
    const { uuid, tags, databaseName } = input;
    // Validate string inputs
    if (!isJXASafeString(uuid)) {
        return { success: false, error: "UUID contains invalid characters" };
    }
    for (const tag of tags) {
        if (!isJXASafeString(tag)) {
            return { success: false, error: `Tag "${tag}" contains invalid characters` };
        }
    }
    if (databaseName && !isJXASafeString(databaseName)) {
        return { success: false, error: "Database name contains invalid characters" };
    }
    const script = `
    (() => {
      const theApp = ${JXA_DEVONTHINK_APP};
      theApp.includeStandardAdditions = true;
      
      // Inject helper functions
      ${getRecordLookupHelpers()}
      
      try {
        // Use the unified lookup function
        const lookupOptions = {
          uuid: ${uuid ? `"${escapeStringForJXA(uuid)}"` : "null"}
        };
        
        const lookupResult = getRecord(theApp, lookupOptions);
        
        if (!lookupResult.record) {
          return JSON.stringify({
            success: false,
            error: "Record with UUID " + (${uuid ? `"${escapeStringForJXA(uuid)}"` : "null"} || "unknown") + " not found"
          });
        }
        
        const record = lookupResult.record;
        
        // Verify database if specified
        const pDatabaseName = ${databaseName ? `"${escapeStringForJXA(databaseName)}"` : "null"};
        if (pDatabaseName && record.database().name() !== pDatabaseName) {
          return JSON.stringify({
            success: false,
            error: "Record with UUID " + (${uuid ? `"${escapeStringForJXA(uuid)}"` : "null"} || "unknown") + " not found in database " + (pDatabaseName || "unknown")
          });
        }
        
        const existingTags = record.tags();
        const tagsToRemove = new Set(${JSON.stringify(tags)});
        const newTags = existingTags.filter(tag => !tagsToRemove.has(tag));
        record.tags = newTags;
        
        return JSON.stringify({
          success: true
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
export const removeTagsTool = {
    name: "remove_tags",
    description: 'Removes tags from a specific record in DEVONthink.\n\nExample:\n{\n  "uuid": "1234-5678-90AB-CDEF",\n  "tags": ["old-tag"]\n}',
    inputSchema: toToolInputSchema(RemoveTagsSchema),
    run: removeTags,
};
