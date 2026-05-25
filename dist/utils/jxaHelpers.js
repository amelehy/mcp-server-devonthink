/**
 * JXA Helper Functions
 * These functions are injected into JXA scripts to provide common functionality
 */
/**
 * Helper function to lookup a record by UUID
 */
export const lookupByUuidHelper = `
function lookupByUuid(theApp, uuid) {
  if (!uuid) return null;
  try {
    return theApp.getRecordWithUuid(uuid);
  } catch (e) {
    return null;
  }
}`;
/**
 * Helper function to lookup a record by ID
 */
export const lookupByIdHelper = `
function lookupById(theApp, id) {
  if (!id || typeof id !== "number") return null;
  try {
    return theApp.getRecordWithId(id);
  } catch (e) {
    return null;
  }
}`;
/**
 * Helper function to lookup a record by path
 * Navigates the hierarchy by splitting the path and traversing children
 * If database is provided, starts from database.root(), otherwise searches globally
 */
export const lookupByPathHelper = `
function lookupByPath(theApp, path, database) {
  if (!path) return null;
  try {
    // Split path into components, filtering out empty strings from leading/trailing slashes
    const pathComponents = path.split("/").filter(p => p.length > 0);

    // If no components (root path), return database root or null
    // Path lookups require a database context.
    if (!database) {
      return null;
    }

    // If no components (e.g. path was "/"), return the database root.
    if (pathComponents.length === 0) {
      return database.root();
    }

    let current = database.root();

    // Navigate through each path component
    for (const component of pathComponents) {
      const children = current.children();
      const found = children.find(c => c.name() === component);
      if (!found) return null;
      current = found;
    }

    return current;
  } catch (e) {
    return null;
  }
}`;
/**
 * Helper function to lookup a record by name
 */
export const lookupByNameHelper = `
function lookupByName(theApp, name, database) {
  if (!name || !database) return null;
  try {
    const searchOptions = {};
    searchOptions["in"] = database;
    const searchResults = theApp.search(name, searchOptions);
    if (!searchResults || searchResults.length === 0) return null;
    
    // Find exact name match
    const matches = searchResults.filter(r => r.name() === name);
    return matches.length > 0 ? matches[0] : null;
  } catch (e) {
    return null;
  }
}`;
/**
 * Master lookup function that tries all methods in order
 */
export const getRecordHelper = `
function getRecord(theApp, options) {
  if (!options) return null;
  
  let record = null;
  let error = null;
  
  // Try UUID first (most reliable)
  if (options.uuid) {
    record = lookupByUuid(theApp, options.uuid);
    if (record) {
      const result = {};
      result["record"] = record;
      result["method"] = "uuid";;
      return result;
    }
    // Use safer error message construction
    const uuidValue = options.uuid || "undefined";
    error = "UUID not found: " + uuidValue;
  }
  
  // Try ID next (fast and reliable)
  if (options.id) {
    record = lookupById(theApp, options.id);
    if (record) {
      const result = {};
      result["record"] = record;
      result["method"] = "id";
      return result;
    }
    const idValue = options.id || "undefined";
    if (!error) error = "ID not found: " + idValue;
  }
  
  // Try path (fast)
  if (options.path) {
    record = lookupByPath(theApp, options.path, options.database);
    if (record) {
      const result = {};
      result["record"] = record;
      result["method"] = "path";
      return result;
    }
    const pathValue = options.path || "undefined";
    if (!error) error = "Path not found: " + pathValue;
  }
  
  // Try name search as fallback (slower)
  if (options.name && options.database) {
    record = lookupByName(theApp, options.name, options.database);
    if (record) {
      const result = {};
      result["record"] = record;
      result["method"] = "name";
      return result;
    }
    const nameValue = options.name || "undefined";
    if (!error) error = "Name not found: " + nameValue;
  }
  
  const errorResult = {};
  errorResult["record"] = null;
  errorResult["error"] = error || "No valid lookup parameters provided";
  return errorResult;
}`;
/**
 * Helper to validate if a record is a group
 */
export const isGroupHelper = `
function isGroup(record) {
  if (!record) return false;
  try {
    const type = record.recordType();
    if (type === "group" || type === "smart group") return true;
  } catch (e) {}
  try {
    const kind = record.kind();
    return kind === "Group" || kind === "Smart Group";
  } catch (e2) {}
  return false;
}`;
/**
 * Helper to detect DEVONthink version for backward compatibility
 */
export const versionHelper = `
function isVersion41OrLater(theApp) {
  try {
    const versionString = theApp.version();
    const parts = versionString.split(".");
    const major = parseInt(parts[0], 10);
    const minor = parseInt(parts[1], 10);
    if (isNaN(major) || isNaN(minor)) {
      return false;
    }
    return major > 4 || (major === 4 && minor >= 1);
  } catch (e) {
    return false;
  }
}`;
/**
 * Safely call a zero-arg getter; returns undefined if missing or throws (e.g. Standard edition).
 */
export const safeOptionalCallHelper = `
function safeOptionalCall(getter) {
  try {
    const value = getter();
    if (value !== undefined && value !== null) return value;
  } catch (e) {}
  return undefined;
}`;
/**
 * Database audit/revision proof — version-dependent (4.1+ vs earlier).
 */
export const applyDatabaseAuditProofHelper = `
function applyDatabaseAuditProof(db, info) {
  try {
    info.revisionProof = db.revisionProof();
  } catch (e) {
    try {
      info.auditProof = db.auditProof();
    } catch (e2) {}
  }
}`;
/**
 * Optional database comment.
 */
export const applyDatabaseCommentHelper = `
function applyDatabaseComment(db, info) {
  const comment = safeOptionalCall(() => db.comment());
  if (comment) info.comment = comment;
}`;
/**
 * Database fields that may be missing or throw on DEVONthink Standard (e.g. filename, spotlightIndexing).
 */
export const applyDatabaseOptionalFieldsHelper = `
function applyDatabaseOptionalFields(db, info) {
  const filename = safeOptionalCall(() => db.filename());
  if (filename !== undefined) info.filename = filename;
  const spotlightIndexing = safeOptionalCall(() => db.spotlightIndexing());
  if (spotlightIndexing !== undefined) info.spotlightIndexing = spotlightIndexing;
  const versioning = safeOptionalCall(() => db.versioning());
  if (versioning !== undefined) info.versioning = versioning;
}`;
/**
 * recordType() throws on some DT3 Standard records; kind() is a reliable fallback.
 */
export const getRecordTypeOrKindHelper = `
function getRecordTypeOrKind(record) {
  try {
    const rt = record.recordType();
    if (rt !== undefined && rt !== null) return rt;
  } catch (e) {}
  try {
    return record.kind();
  } catch (e2) {}
  return undefined;
}`;
/**
 * Read record body text; avoids recordType() which throws on some DT3 Standard records.
 */
export const getRecordTextContentHelper = `
function getRecordTextContent(record) {
  const typeOrKind = getRecordTypeOrKind(record);
  const kind = (safeOptionalCall(() => record.kind()) || "").toLowerCase();
  const plain = () => safeOptionalCall(() => record.plainText());
  const rich = () => safeOptionalCall(() => record.richText());
  if (typeOrKind === "markdown" || typeOrKind === "txt" || typeOrKind === "formatted note") {
    return plain();
  }
  if (typeOrKind === "rtf") {
    return rich() || plain();
  }
  if (kind.indexOf("rich text") >= 0) {
    return rich() || plain();
  }
  return plain() || rich();
}`;
/**
 * Search scope for a database: DT3+ requires root(), not the database object (see search tool).
 */
export const databaseSearchScopeHelper = `
function databaseSearchScope(db) {
  try {
    if (db && typeof db.root === "function") {
      return db.root();
    }
  } catch (e) {}
  return db;
}`;
/**
 * Record exclude* flags — often unavailable on DEVONthink Standard.
 */
export const applyRecordExcludeFlagsHelper = `
function applyRecordExcludeFlags(record, properties) {
  const names = [
    "excludeFromChat",
    "excludeFromClassification",
    "excludeFromSearch",
    "excludeFromSeeAlso",
    "excludeFromTagging",
    "excludeFromWikiLinking"
  ];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    try {
      if (record[name] && record[name]() !== undefined) {
        properties[name] = record[name]();
      }
    } catch (e) {}
  }
}`;
/**
 * Helpers for DEVONthink edition / version differences (inject into JXA scripts).
 */
export function getEditionCompatHelpers() {
    return `
    ${safeOptionalCallHelper}
    ${applyDatabaseAuditProofHelper}
    ${applyDatabaseCommentHelper}
    ${applyDatabaseOptionalFieldsHelper}
    ${applyRecordExcludeFlagsHelper}
  `;
}
/**
 * Helper to get database by name or use current
 */
export const getDatabaseHelper = `
function getDatabase(theApp, databaseName) {
  if (!databaseName) {
    return theApp.currentDatabase();
  }

  const databases = theApp.databases();
  const found = databases.find(db => db.name() === databaseName);
  if (!found) {
    throw new Error("Database not found: " + databaseName);
  }
  return found;
}

function getDatabaseByUuid(theApp, databaseUuid) {
  if (!databaseUuid) return null;
  const databases = theApp.databases();
  return databases.find(db => db.uuid() === databaseUuid) || null;
}

function resolveDatabase(theApp, databaseName, databaseUuid) {
  if (databaseUuid) {
    const db = getDatabaseByUuid(theApp, databaseUuid);
    if (!db) {
      throw new Error("Database not found with UUID: " + databaseUuid);
    }
    return db;
  }
  return getDatabase(theApp, databaseName);
}`;
/**
 * Helper to convert DEVONthink record objects to plain JavaScript objects
 */
export const convertDevonthinkRecordHelper = `
function convertDevonthinkRecord(record) {
  if (!record) return null;
  
  const converted = {};
  try {
    // Basic properties
    converted["id"] = record.id();
    converted["uuid"] = record.uuid();
    converted["name"] = record.name();
    converted["type"] = record.type();
    converted["recordType"] = record.recordType();
    converted["location"] = record.location();
    converted["path"] = record.path();
    
    // Dates
    converted["creationDate"] = record.creationDate();
    converted["modificationDate"] = record.modificationDate();
    converted["additionDate"] = record.additionDate();
    
    // Size and counts
    converted["size"] = record.size();
    const wordCount = safeOptionalCall(() => record.wordCount());
    if (wordCount !== undefined) converted["wordCount"] = wordCount;
    const characterCount = safeOptionalCall(() => record.characterCount());
    if (characterCount !== undefined) converted["characterCount"] = characterCount;
    
    // URLs and aliases
    converted["url"] = record.url();
    const referenceURL = safeOptionalCall(() => record.referenceURL());
    if (referenceURL !== undefined) converted["referenceURL"] = referenceURL;
    converted["aliases"] = record.aliases();
    
    // Tags and metadata
    converted["tags"] = record.tags();
    converted["comment"] = record.comment();
    converted["rating"] = record.rating();
    converted["label"] = record.label();
    
    // State flags
    converted["flagged"] = record.flagged();
    converted["unread"] = record.unread();
    converted["locking"] = record.locking();

    applyRecordExcludeFlags(record, converted);
    
    // Database info
    const db = record.database();
    if (db) {
      converted["databaseName"] = db.name();
      converted["databaseUuid"] = db.uuid();
    }
  } catch (e) {
    // If any property fails, continue with what we have
  }
  
  return converted;
}`;
/**
 * Get all JXA helpers as a single string
 */
export function getJXAHelpers() {
    return `
    // JXA Helper Functions
    ${getEditionCompatHelpers()}
    ${lookupByUuidHelper}
    ${lookupByIdHelper}
    ${lookupByPathHelper}
    ${lookupByNameHelper}
    ${getRecordHelper}
    ${isGroupHelper}
    ${getDatabaseHelper}
    ${convertDevonthinkRecordHelper}
  `;
}
/**
 * Get specific helpers
 */
export function getRecordLookupHelpers() {
    return `
    ${lookupByUuidHelper}
    ${lookupByIdHelper}
    ${lookupByPathHelper}
    ${lookupByNameHelper}
    ${getRecordHelper}
  `;
}
/**
 * Format lookup options for JXA
 */
export function formatLookupOptions(uuid, id, path, name, databaseName) {
    const options = [];
    if (uuid)
        options.push(`uuid: ${JSON.stringify(uuid)}`);
    if (id !== undefined)
        options.push(`id: ${id}`);
    if (path)
        options.push(`path: ${JSON.stringify(path)}`);
    if (name)
        options.push(`name: ${JSON.stringify(name)}`);
    if (databaseName)
        options.push(`databaseName: ${JSON.stringify(databaseName)}`);
    return `{ ${options.join(", ")} }`;
}
