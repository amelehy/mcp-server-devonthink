# DEVONthink edition compatibility

This MCP server targets **DEVONthink 3** on macOS. It uses **JavaScript for Automation (JXA)** against the app name registered as `"DEVONthink 3"` (not `"DEVONthink"`).

## Editions

| Edition | Core tools (list/search/read/write tags) | Notes |
|--------|-------------------------------------------|-------|
| **Standard** | Supported when DEVONthink is running and Automation permission is granted | Some JXA properties and AI APIs are unavailable; tools degrade gracefully |
| **Pro / Server** | Full feature set | AI classification, compare, and built-in AI tools require Pro capabilities |

The README historically stated “DEVONthink Pro only.” In practice, **Standard exposes enough of the scripting dictionary** for most record and database operations once the correct application name is used. Failures on Standard are usually **missing properties** or **Pro-only APIs**, not `Application can't be found`.

## Application name

```javascript
Application("DEVONthink 3")  // correct on typical DT3 installs
Application("DEVONthink")    // fails with error -2700
```

A filesystem symlink at `/Applications/DEVONthink.app` does **not** fix JXA lookup (macOS resolves by bundle ID / registered name).

## Optional properties (Standard may omit)

These are read or written inside `try/catch` via helpers in `src/utils/jxaHelpers.ts` (`getEditionCompatHelpers()`). If a property is unavailable, it is skipped instead of failing the whole tool call.

### Record (`get_record_properties`, `set_record_properties`)

| Property | Used by |
|----------|---------|
| `excludeFromChat` | get / set |
| `excludeFromClassification` | get / set |
| `excludeFromSearch` | get / set |
| `excludeFromSeeAlso` | get / set |
| `excludeFromTagging` | get / set (groups only for set) |
| `excludeFromWikiLinking` | get / set |
| `wordCount` | get (optional) |
| `characterCount` | get (optional) |
| `plainText` | get (text record types; optional) |

### Database (`get_open_databases`, `current_database`)

| Property | Notes |
|----------|--------|
| `revisionProof` | DEVONthink 4.1+ |
| `auditProof` | DEVONthink before 4.1 |
| `comment` | Optional on database object |
| `filename` | May throw on Standard (`Can't get object`) |
| `spotlightIndexing` | Pro / may throw on Standard (`Can't convert types`) |
| `versioning` | Pro / may throw on Standard (`Can't convert types`) |

### Search (`search`)

| Issue | Notes |
|-------|--------|
| `in: database` | Invalid on DT3; use `database.root()` as search scope |
| `record.recordType()` | May throw on some records; fallback to `kind()` |

### Record metadata (other tools)

| Property | Notes |
|----------|--------|
| `referenceURL` | Usually available; lookup by URL uses try/catch where needed |

## Pro-oriented / AI tools

These call DEVONthink APIs that may be absent or limited on Standard:

- `classify` — `theApp.classify(...)`
- `compare` — similarity / comparison APIs
- `check_ai_health`, `ask_ai_about_documents`, `create_summary_document`, `get_tool_documentation`

On failure, the tool returns `{ success: false, error: "..." }` rather than crashing the MCP server.

## macOS permissions

Grant **Automation** (and if prompted, **Accessibility**) for Claude Desktop / your terminal to control DEVONthink in **System Settings → Privacy & Security**.

## Contributing

When adding a new JXA property access, use `safeOptionalCall` / `applyRecordExcludeFlags` / `applyDatabaseAuditProof` from `getEditionCompatHelpers()`, or an explicit `try/catch`, and document the property in this file.
