import { z } from "zod";
import { executeJxa } from "../applescript/execute.js";
import { JXA_DEVONTHINK_APP } from "../constants.js";
import { escapeSearchQuery, formatValueForJXA, isJXASafeString, escapeStringForJXA, } from "../utils/escapeString.js";
import { getRecordLookupHelpers, getDatabaseHelper, isGroupHelper, databaseSearchScopeHelper, getRecordTypeOrKindHelper, getEditionCompatHelpers, } from "../utils/jxaHelpers.js";
import { toToolInputSchema } from "../utils/toolInputSchema.js";
const SearchSchema = z
    .object({
    query: z.string().describe("Search query string"),
    groupUuid: z.string().optional().describe("UUID of the group to search in (optional)"),
    groupId: z
        .number()
        .optional()
        .describe("ID of the group to search in (optional, requires databaseName)"),
    groupPath: z
        .string()
        .optional()
        .describe("Database-relative path of the group to search in (e.g., '/Inbox', '/Projects/Archive'). MUST be used with databaseName parameter. Do NOT include the database name in the path."),
    databaseName: z
        .string()
        .optional()
        .describe("Database name (optional, required when using groupId or groupPath)"),
    databaseUuid: z
        .string()
        .optional()
        .describe("Database UUID from get_open_databases (alternative to databaseName)"),
    useCurrentGroup: z
        .boolean()
        .optional()
        .describe("Search in the currently selected group (optional)"),
    recordType: z
        .enum([
        "group",
        "markdown",
        "PDF",
        "bookmark",
        "formatted note",
        "txt",
        "rtf",
        "rtfd",
        "webarchive",
        "quicktime",
        "picture",
        "smart group",
    ])
        .optional()
        .describe("Filter results by record type (optional)"),
    comparison: z
        .enum(["no case", "no umlauts", "fuzzy", "related"])
        .optional()
        .describe("Comparison type for the search (optional)"),
    excludeSubgroups: z
        .boolean()
        .optional()
        .describe("Exclude subgroups from the search (optional)"),
    limit: z.number().optional().describe("Maximum number of results to return (optional)"),
})
    .strict()
    .refine((data) => {
    const hasDb = !!(data.databaseName || data.databaseUuid);
    // If groupId is provided, database must also be provided
    if (data.groupId !== undefined && !hasDb) {
        return false;
    }
    // If groupPath is provided, database must also be provided
    if (data.groupPath && !hasDb) {
        return false;
    }
    // If useCurrentGroup is true, other group parameters should not be provided
    if (data.useCurrentGroup && (data.groupUuid || data.groupId || data.groupPath)) {
        return false;
    }
    return true;
}, {
    message: "databaseName is required when using groupId or groupPath; when useCurrentGroup is true, other group parameters should not be provided",
});
const search = async (input) => {
    const { query, groupUuid, groupId, groupPath, databaseName, databaseUuid, useCurrentGroup, recordType, comparison, excludeSubgroups, limit = 50, } = input;
    // Validate inputs
    if (!isJXASafeString(query)) {
        return {
            success: false,
            error: "Search query contains invalid characters",
        };
    }
    if (groupUuid && !isJXASafeString(groupUuid)) {
        return {
            success: false,
            error: "Group UUID contains invalid characters",
        };
    }
    if (groupPath && !isJXASafeString(groupPath)) {
        return {
            success: false,
            error: "Group path contains invalid characters",
        };
    }
    if (databaseName && !isJXASafeString(databaseName)) {
        return {
            success: false,
            error: "Database name contains invalid characters",
        };
    }
    if (databaseUuid && !isJXASafeString(databaseUuid)) {
        return {
            success: false,
            error: "Database UUID contains invalid characters",
        };
    }
    // Escape the search query
    const escapedQuery = escapeSearchQuery(query);
    const script = `
    (() => {
      const theApp = ${JXA_DEVONTHINK_APP};
      theApp.includeStandardAdditions = true;
      
      // Inject helper functions
      ${getRecordLookupHelpers()}
      ${getDatabaseHelper}
      ${isGroupHelper}
      ${databaseSearchScopeHelper}
      ${getEditionCompatHelpers()}
      ${getRecordTypeOrKindHelper}
      
      try {
        // Define variables for lookup
        const pGroupUuid = ${groupUuid ? `"${escapeStringForJXA(groupUuid)}"` : "null"};
        const pGroupId = ${groupId !== undefined ? groupId : "null"};
        const pGroupPath = ${groupPath ? `"${escapeStringForJXA(groupPath)}"` : "null"};
        const pDatabaseName = ${databaseName ? `"${escapeStringForJXA(databaseName)}"` : "null"};
        const pDatabaseUuid = ${databaseUuid ? `"${escapeStringForJXA(databaseUuid)}"` : "null"};
        const pUseCurrentGroup = ${useCurrentGroup === true};
        const pRecordType = ${formatValueForJXA(recordType)};
        const pComparison = ${formatValueForJXA(comparison)};
        const pExcludeSubgroups = ${excludeSubgroups !== undefined ? excludeSubgroups : "null"};
        const pLimit = ${limit};


        let searchScope;
        let targetDatabase;
        
        // Get target database
        targetDatabase = resolveDatabase(theApp, pDatabaseName, pDatabaseUuid);
        
        // Determine search scope
        if (pUseCurrentGroup) {
          searchScope = theApp.currentGroup();
          if (!searchScope) {
            return JSON.stringify({ success: false, error: "No group is currently selected in DEVONthink" });
          }
          if (!isGroup(searchScope)) {
            return JSON.stringify({ success: false, error: "Current selection is not a group. Type: " + searchScope.recordType() });
          }
        } else if (pGroupUuid || pGroupId || pGroupPath) {
          
          let lookupOptions;
          try {
            lookupOptions = {};
            lookupOptions["uuid"] = pGroupUuid;
            lookupOptions["id"] = pGroupId;
            lookupOptions["path"] = pGroupPath;
            lookupOptions["database"] = targetDatabase;
            // Don't stringify if it contains database object
            const safeOptions = {};
            safeOptions["uuid"] = lookupOptions["uuid"];
            safeOptions["id"] = lookupOptions["id"];
            safeOptions["path"] = lookupOptions["path"];
            safeOptions["hasDatabase"] = lookupOptions["database"] ? true : false;
          } catch (e) {
            return JSON.stringify({ success: false, error: "Error creating lookup options: " + e.toString() });
          }
          
          const lookupResult = getRecord(theApp, lookupOptions);
          
          // Don't try to stringify the record object
          
          if (!lookupResult.record) {
            let errorDetails = lookupResult.error || "Group not found";
            if (pGroupUuid) {
              errorDetails = "Group with UUID not found: " + pGroupUuid;
            } else if (pGroupId) {
              errorDetails = "Group with ID " + pGroupId + " not found in database '" + (targetDatabase ? targetDatabase.name() : 'Unknown') + "'";
            } else if (pGroupPath) {
              errorDetails = "Group at path not found: " + pGroupPath;
            }
            return JSON.stringify({ success: false, error: errorDetails });
          }
          
          searchScope = lookupResult.record;
          
          try {
            const isGroupResult = isGroup(searchScope);
            if (!isGroupResult) {
              const recordType = searchScope.recordType();
              return JSON.stringify({ success: false, error: "Specified record is not a group. Type: " + recordType });
            }
          } catch (e) {
            return JSON.stringify({ success: false, error: "Error checking if record is a group: " + e.toString() });
          }
        } else if (targetDatabase) {
          // Database object is not a valid search scope; use root() (required on DT3 Standard too)
          searchScope = databaseSearchScope(targetDatabase);
        } else {
          searchScope = null; // Search all databases
        }
        
        const searchOptions = {};
        if (searchScope) {
          searchOptions["in"] = searchScope;
        }
        if (pComparison) {
          searchOptions["comparison"] = pComparison;
        }
        if (pExcludeSubgroups !== null) {
          searchOptions["excludeSubgroups"] = pExcludeSubgroups;
        }
        
        
        let searchResults;
        try {
          searchResults = theApp.search("${escapedQuery}", searchOptions);
        } catch (e) {
          return JSON.stringify({ success: false, error: "Error executing search: " + e.toString() });
        }
        
        if (!searchResults || searchResults.length === 0) {
          return JSON.stringify({ success: true, results: [], totalCount: 0 });
        }
        
        let filteredResults = searchResults;
        if (pRecordType) {
          filteredResults = searchResults.filter(record => getRecordTypeOrKind(record) === pRecordType);
        }
        
        const limitedResults = filteredResults.slice(0, pLimit);
        
        const results = limitedResults.map((record, index) => {
          try {
            const result = {};
            result["id"] = record.id();
            result["uuid"] = record.uuid();
            result["name"] = record.name();
            result["path"] = record.path();
            result["location"] = record.location();
            result["recordType"] = getRecordTypeOrKind(record);
            const kind = safeOptionalCall(() => record.kind());
            if (kind !== undefined) result["kind"] = kind;
            result["creationDate"] = record.creationDate() ? record.creationDate().toString() : null;
            result["modificationDate"] = record.modificationDate() ? record.modificationDate().toString() : null;
            result["tags"] = record.tags();
            result["size"] = record.size();
            
            try {
              if (record.score && record.score() !== undefined) {
                result["score"] = record.score();
              }
            } catch (e) {}
            
            return result;
          } catch (e) {
            throw e;
          }
        });
        
        return JSON.stringify({ success: true, results: results, totalCount: filteredResults.length });
      } catch (error) {
        return JSON.stringify({ success: false, error: error.toString() });
      }
    })();
  `;
    return await executeJxa(script);
};
export const searchTool = {
    name: "search",
    description: `Search DEVONthink records. Examples: {"query": "invoice"} or {"query": "project review", "groupPath": "/Meetings", "databaseName": "MyDB"}. Note: groupPath requires databaseName and must be database-relative (e.g., "/Meetings" not "/MyDB/Meetings").`,
    inputSchema: toToolInputSchema(SearchSchema),
    run: search,
};
