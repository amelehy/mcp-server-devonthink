import { z } from "zod";
import { executeJxa } from "../applescript/execute.js";
import { escapeStringForJXA, isJXASafeString } from "../utils/escapeString.js";
import { getRecordLookupHelpers, getDatabaseHelper } from "../utils/jxaHelpers.js";
import { JXA_DEVONTHINK_APP } from "../constants.js";
import { toToolInputSchema } from "../utils/toolInputSchema.js";
const ClassifySchema = z
    .object({
    recordUuid: z.string().describe("UUID of the record to classify"),
    databaseName: z.string().optional().describe("Database name to search in (optional)"),
    comparison: z
        .enum(["data comparison", "tags comparison"])
        .optional()
        .describe("Comparison type for classification (optional)"),
    tags: z.boolean().optional().describe("Propose tags instead of groups (optional)"),
})
    .strict();
const classify = async (input) => {
    const { recordUuid, databaseName, comparison, tags } = input;
    // Validate string inputs
    if (!isJXASafeString(recordUuid)) {
        return { success: false, error: "Record UUID contains invalid characters" };
    }
    if (databaseName && !isJXASafeString(databaseName)) {
        return { success: false, error: "Database name contains invalid characters" };
    }
    if (comparison && !isJXASafeString(comparison)) {
        return { success: false, error: "Comparison type contains invalid characters" };
    }
    const script = `
    (() => {
      const theApp = ${JXA_DEVONTHINK_APP};
      theApp.includeStandardAdditions = true;
      
      // Inject helper functions
      ${getRecordLookupHelpers()}
      ${getDatabaseHelper}
      
      try {
        // Get target database
        const targetDatabase = getDatabase(theApp, ${databaseName ? `"${escapeStringForJXA(databaseName)}"` : "null"});

        // Use the unified lookup function
        const lookupOptions = {
          uuid: ${recordUuid ? `"${escapeStringForJXA(recordUuid)}"` : "null"}
        };
        
        const lookupResult = getRecord(theApp, lookupOptions);
        
        if (!lookupResult.record) {
          return JSON.stringify({
            success: false,
            error: "Record not found with UUID: " + (${recordUuid ? `"${escapeStringForJXA(recordUuid)}"` : "null"} || "unknown")
          });
        }
        
        const targetRecord = lookupResult.record;
        
        // Build classify options
        const classifyOptions = { record: targetRecord };
        if (targetDatabase) {
          classifyOptions.in = targetDatabase;
        }
        if (${comparison ? `"${escapeStringForJXA(comparison)}"` : "null"}) {
          classifyOptions.comparison = ${comparison ? `"${escapeStringForJXA(comparison)}"` : "null"};
        }
        if (${tags || false}) {
          classifyOptions.tags = ${tags};
        }
        
        // Perform classification
        const classifyResults = theApp.classify(classifyOptions);
        
        if (!classifyResults || classifyResults.length === 0) {
          return JSON.stringify({
            success: true,
            proposals: [],
            totalCount: 0
          });
        }
        
        // Extract proposal information
        const proposals = classifyResults.map(proposal => {
          const result = {
            name: proposal.name(),
            type: proposal.recordType ? proposal.recordType() : "group"
          };
          
          // Add location if available
          try {
            if (proposal.location) {
              result.location = proposal.location();
            }
          } catch (e) {
            // Location might not be available for all proposals
          }
          
          // Add score if available
          try {
            if (proposal.score && proposal.score() !== undefined) {
              result.score = proposal.score();
            }
          } catch (e) {
            // Score might not be available for all proposals
          }
          
          return result;
        });
        
        return JSON.stringify({
          success: true,
          proposals: proposals,
          totalCount: classifyResults.length
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
export const classifyTool = {
    name: "classify",
    description: 'Get classification proposals for a DEVONthink record.\n\nExample:\n{\n  "recordUuid": "1234-5678-90AB-CDEF"\n}',
    inputSchema: toToolInputSchema(ClassifySchema),
    run: classify,
};
