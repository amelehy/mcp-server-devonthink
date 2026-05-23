/**
 * JXA Application() name as registered on macOS.
 * DEVONthink 3 installs as "DEVONthink 3", not "DEVONthink".
 */
export const DEVONTHINK_APPLICATION_NAME = "DEVONthink 3" as const;

/** Expression for embedding in JXA script strings */
export const JXA_DEVONTHINK_APP = `Application(${JSON.stringify(DEVONTHINK_APPLICATION_NAME)})`;
