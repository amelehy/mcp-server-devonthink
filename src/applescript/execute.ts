import { execFile } from "child_process";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
export const executeJxa = <T>(script: string): Promise<T> => {
	return new Promise((resolve, reject) => {
		// Pass the script over stdin rather than `-e`: endpoint security tools
		// (AVG, SentinelOne) SIGKILL osascript when a large inline script
		// appears in its command line.
		const child = execFile(
			"/usr/bin/osascript",
			["-l", "JavaScript", "-"],
			(error, stdout, stderr) => {
				if (error) {
					const detail = error.signal
						? `osascript was killed by ${error.signal}`
						: stderr || error.message;
					return reject(
						new McpError(ErrorCode.InternalError, `JXA execution failed: ${detail}`),
					);
				}
				if (stderr) {
					return reject(new McpError(ErrorCode.InternalError, `JXA error: ${stderr}`));
				}
				try {
					const result = JSON.parse(stdout.trim());
					resolve(result as T);
				} catch (parseError) {
					reject(
						new McpError(
							ErrorCode.InternalError,
							`Failed to parse JXA output: ${parseError}`,
						),
					);
				}
			},
		);
		child.stdin?.end(script);
	});
};
