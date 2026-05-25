import { z } from "zod";
import { executeJxa } from "../applescript/execute.js";
import { JXA_DEVONTHINK_APP } from "../constants.js";
import { toToolInputSchema } from "../utils/toolInputSchema.js";
const GetSelectedRecordsSchema = z.object({}).strict();
const getSelectedRecords = async () => {
    const script = `
    (() => {
      const theApp = ${JXA_DEVONTHINK_APP};
      theApp.includeStandardAdditions = true;
      
      try {
        const selection = theApp.selection();
        
        if (!selection || selection.length === 0) {
          return JSON.stringify({
            success: true,
            records: [],
            totalCount: 0
          });
        }
        
        const recordInfos = selection.map(record => {
          const info = {
            id: record.id(),
            uuid: record.uuid(),
            name: record.name(),
            path: record.path(),
            location: record.location(),
            recordType: record.recordType(),
            kind: record.kind(),
            creationDate: record.creationDate() ? record.creationDate().toString() : null,
            modificationDate: record.modificationDate() ? record.modificationDate().toString() : null,
            tags: record.tags(),
            size: record.size()
          };
          
          // Add optional properties if available
          if (record.rating && record.rating() !== undefined) {
            info.rating = record.rating();
          }
          
          if (record.label && record.label() !== undefined) {
            info.label = record.label();
          }
          
          if (record.comment && record.comment()) {
            info.comment = record.comment();
          }
          
          return info;
        });
        
        return JSON.stringify({
          success: true,
          records: recordInfos,
          totalCount: selection.length
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
export const selectedRecordsTool = {
    name: "selected_records",
    description: "Get information about currently selected records in DEVONthink.\n\nExample:\n{}",
    inputSchema: toToolInputSchema(GetSelectedRecordsSchema),
    run: getSelectedRecords,
};
