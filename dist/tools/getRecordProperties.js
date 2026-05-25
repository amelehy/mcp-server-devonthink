import { z } from "zod";
import { executeJxa } from "../applescript/execute.js";
import { escapeStringForJXA, isJXASafeString } from "../utils/escapeString.js";
import { getRecordLookupHelpers, getDatabaseHelper, getEditionCompatHelpers, } from "../utils/jxaHelpers.js";
import { JXA_DEVONTHINK_APP } from "../constants.js";
import { toToolInputSchema } from "../utils/toolInputSchema.js";
const GetRecordPropertiesSchema = z
    .object({
    uuid: z.string().optional().describe("UUID of the record"),
    recordId: z.number().optional().describe("ID of the record to get properties for"),
    recordPath: z
        .string()
        .optional()
        .describe("DEVONthink location path of the record (e.g., '/Inbox/My Document')"),
    databaseName: z
        .string()
        .optional()
        .describe("Database to get the record properties from (optional)"),
})
    .strict()
    .refine((data) => data.uuid !== undefined || data.recordId !== undefined || data.recordPath !== undefined, {
    message: "Either uuid, recordId, or recordPath must be provided",
});
const getRecordProperties = async (input) => {
    const { uuid, recordId, recordPath, databaseName } = input;
    // Validate string inputs
    if (uuid && !isJXASafeString(uuid)) {
        return { success: false, error: "UUID contains invalid characters" };
    }
    if (recordPath && !isJXASafeString(recordPath)) {
        return { success: false, error: "Record path contains invalid characters" };
    }
    if (databaseName && !isJXASafeString(databaseName)) {
        return {
            success: false,
            error: "Database name contains invalid characters",
        };
    }
    const script = `
    (() => {
      const theApp = ${JXA_DEVONTHINK_APP};
      theApp.includeStandardAdditions = true;

      // Inject helper functions
      ${getEditionCompatHelpers()}
      ${getRecordLookupHelpers()}
      ${getDatabaseHelper}

      try {
        // Get target database
        const targetDatabase = getDatabase(theApp, ${databaseName ? `"${escapeStringForJXA(databaseName)}"` : "null"});

        // Build lookup options
        const lookupOptions = {
          uuid: ${uuid ? `"${escapeStringForJXA(uuid)}"` : "null"},
          id: ${recordId !== undefined ? recordId : "null"},
          path: ${recordPath ? `"${escapeStringForJXA(recordPath)}"` : "null"},
          name: null,
          database: targetDatabase
        };

        // Use the unified lookup function
        const lookupResult = getRecord(theApp, lookupOptions);

        if (!lookupResult.record) {
          // Build detailed error message
          let errorDetails = lookupResult.error || "Record not found";
          if (${recordId !== undefined ? recordId : "null"}) {
            errorDetails = "Record with ID " + ${recordId} + " not found in database '" + targetDatabase.name() + "'";
          } else if (${uuid ? `"${escapeStringForJXA(uuid)}"` : "null"}) {
            errorDetails = "Record with UUID " + (${uuid ? `"${escapeStringForJXA(uuid)}"` : "null"} || "unknown") + " not found";
          } else if (${recordPath ? `"${escapeStringForJXA(recordPath)}"` : "null"}) {
            errorDetails = "Record at DEVONthink location path " + (${recordPath ? `"${escapeStringForJXA(recordPath)}"` : "null"} || "unknown") + " not found";
          }

          return JSON.stringify({
            success: false,
            error: errorDetails
          });
        }

        const targetRecord = lookupResult.record;

        // Get all properties
        const properties = {
          success: true,
          id: targetRecord.id(),
          uuid: targetRecord.uuid(),
          name: targetRecord.name(),
          path: targetRecord.path(),
          location: targetRecord.location(),
          recordType: targetRecord.recordType(),
          kind: targetRecord.kind(),
          creationDate: targetRecord.creationDate() ? targetRecord.creationDate().toString() : null,
          modificationDate: targetRecord.modificationDate() ? targetRecord.modificationDate().toString() : null,
          additionDate: targetRecord.additionDate() ? targetRecord.additionDate().toString() : null,
          size: targetRecord.size(),
          tags: targetRecord.tags(),
          comment: targetRecord.comment(),
          url: targetRecord.url(),
          rating: targetRecord.rating(),
          label: targetRecord.label(),
          flag: targetRecord.flag(),
          unread: targetRecord.unread(),
          locked: targetRecord.locking()
        };

        const wordCount = safeOptionalCall(() => targetRecord.wordCount());
        if (wordCount !== undefined) properties.wordCount = wordCount;
        const characterCount = safeOptionalCall(() => targetRecord.characterCount());
        if (characterCount !== undefined) properties.characterCount = characterCount;

        applyRecordExcludeFlags(targetRecord, properties);

        // Only include plain text for text-based records and limit size
        if (targetRecord.recordType() === "markdown" ||
            targetRecord.recordType() === "formatted note" ||
            targetRecord.recordType() === "txt") {
          const plainText = safeOptionalCall(() => targetRecord.plainText());
          if (plainText && plainText.length > 0) {
            properties.plainText = plainText.length > 1000 ?
              plainText.substring(0, 1000) + "..." :
              plainText;
          }
        }

        return JSON.stringify(properties);
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
export const getRecordPropertiesTool = {
    name: "get_record_properties",
    description: 'Get detailed properties and metadata for a DEVONthink record.\n\nExample:\n{\n  "uuid": "1234-5678-90AB-CDEF"\n}',
    inputSchema: toToolInputSchema(GetRecordPropertiesSchema),
    run: getRecordProperties,
};
