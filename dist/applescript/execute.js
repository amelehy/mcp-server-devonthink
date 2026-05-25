import { execFile } from "child_process";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
export const executeJxa = (script) => {
    return new Promise((resolve, reject) => {
        execFile("/usr/bin/osascript", ["-l", "JavaScript", "-e", script], (error, stdout, stderr) => {
            if (error) {
                return reject(new McpError(ErrorCode.InternalError, `JXA execution failed: ${error.message}`));
            }
            if (stderr) {
                return reject(new McpError(ErrorCode.InternalError, `JXA error: ${stderr}`));
            }
            try {
                const result = JSON.parse(stdout.trim());
                resolve(result);
            }
            catch (parseError) {
                reject(new McpError(ErrorCode.InternalError, `Failed to parse JXA output: ${parseError}`));
            }
        });
    });
};
