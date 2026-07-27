"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchRealSchemas = fetchRealSchemas;
const collapsLogger_1 = require("./collapsLogger");
const PG_NAMESPACE_SCHEMA_QUERY = `
	SELECT nspname AS table_schema
	FROM pg_catalog.pg_namespace
	WHERE nspname NOT LIKE 'pg_%'
		AND nspname != 'information_schema'
	ORDER BY nspname;
`;
const INFORMATION_SCHEMA_FALLBACK_QUERY = `
	SELECT DISTINCT table_schema
	FROM information_schema.tables
	WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
	ORDER BY table_schema;
`;
async function fetchRealSchemas(client, node = 'CollapsSchemaFetcher', context = 'fetchRealSchemas()') {
    try {
        const result = await (0, collapsLogger_1.queryWithCollapsLog)(client, { node, context }, PG_NAMESPACE_SCHEMA_QUERY, [], (rows) => rows.map((row) => row.table_schema));
        if (result.rows.length > 0) {
            return result.rows.map((row) => row.table_schema);
        }
    }
    catch {
        // Fall through to information_schema fallback.
    }
    const fallbackResult = await (0, collapsLogger_1.queryWithCollapsLog)(client, { node, context: `${context} (fallback)` }, INFORMATION_SCHEMA_FALLBACK_QUERY, [], (rows) => rows.map((row) => row.table_schema));
    return fallbackResult.rows.map((row) => row.table_schema);
}
