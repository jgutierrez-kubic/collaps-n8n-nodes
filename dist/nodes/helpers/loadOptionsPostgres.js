"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCurrentNodeString = readCurrentNodeString;
exports.fetchTableNamesForSchema = fetchTableNamesForSchema;
exports.fetchTableColumns = fetchTableColumns;
exports.toColumnPropertyOptions = toColumnPropertyOptions;
exports.fetchColumnPropertyOptions = fetchColumnPropertyOptions;
exports.buildResourceMapperFields = buildResourceMapperFields;
exports.fetchResourceMapperFieldsForTables = fetchResourceMapperFieldsForTables;
exports.fetchTableColumnsDirect = fetchTableColumnsDirect;
const collapsLogger_1 = require("./collapsLogger");
const postgresClient_1 = require("./postgresClient");
const sqlValidation_1 = require("./sqlValidation");
const COLUMNS_SQL = `
	SELECT column_name
	FROM information_schema.columns
	WHERE table_catalog = current_database()
		AND table_schema = $1
		AND table_name = $2
	ORDER BY ordinal_position
`;
const TABLES_SQL = `
	SELECT table_name
	FROM information_schema.tables
	WHERE table_schema = $1
		AND table_type = 'BASE TABLE'
	ORDER BY table_name
`;
function readCurrentNodeString(context, parameterName, fallback = '') {
    try {
        const value = context.getCurrentNodeParameter(parameterName);
        return String(value !== null && value !== void 0 ? value : fallback).trim();
    }
    catch {
        return fallback;
    }
}
async function fetchTableNamesForSchema(context, schema, logMeta) {
    if (!(0, sqlValidation_1.isValidSqlIdentifier)(schema)) {
        return [];
    }
    const safeSchema = (0, sqlValidation_1.assertValidSqlIdentifier)(schema, 'schema');
    try {
        return await (0, postgresClient_1.withPostgresClient)(context, async (client) => {
            const result = await (0, collapsLogger_1.queryWithCollapsLog)(client, logMeta, TABLES_SQL, [safeSchema], (rows) => rows.map((row) => row.table_name));
            return result.rows
                .map((row) => row.table_name)
                .filter((tableName) => (0, sqlValidation_1.isValidSqlIdentifier)(tableName));
        });
    }
    catch (error) {
        console.error('[loadOptionsPostgres] fetchTableNamesForSchema error:', error);
        return [];
    }
}
async function fetchTableColumns(context, schema, tableName, logMeta = {
    node: 'loadOptionsPostgres',
    context: 'fetchTableColumns()',
}) {
    if (!(0, sqlValidation_1.isValidSqlIdentifier)(schema) || !(0, sqlValidation_1.isValidSqlIdentifier)(tableName)) {
        return [];
    }
    const safeSchema = (0, sqlValidation_1.assertValidSqlIdentifier)(schema, 'schema');
    const safeTable = (0, sqlValidation_1.assertValidSqlIdentifier)(tableName, 'tableName');
    try {
        return await (0, postgresClient_1.withPostgresClient)(context, async (client) => {
            const result = await (0, collapsLogger_1.queryWithCollapsLog)(client, logMeta, COLUMNS_SQL, [safeSchema, safeTable], (rows) => rows.map((row) => row.column_name));
            return result.rows
                .map((row) => row.column_name)
                .filter((column) => (0, sqlValidation_1.isValidSqlIdentifier)(column));
        });
    }
    catch (error) {
        console.error('[loadOptionsPostgres] fetchTableColumns error:', error);
        return [];
    }
}
function toColumnPropertyOptions(columns) {
    return columns
        .map((column) => column.trim())
        .filter((column) => (0, sqlValidation_1.isValidSqlIdentifier)(column))
        .map((column) => ({
        name: column,
        value: column,
    }));
}
async function fetchColumnPropertyOptions(context, schema, tableName, logMeta) {
    const columns = await fetchTableColumns(context, schema, tableName, logMeta);
    return toColumnPropertyOptions(columns);
}
function buildResourceMapperFields(columnsA, columnsB) {
    const sourceColumns = toColumnPropertyOptions(columnsA);
    const targetOptions = toColumnPropertyOptions(columnsB);
    if (sourceColumns.length === 0 || targetOptions.length === 0) {
        return [];
    }
    return sourceColumns.map((column) => ({
        id: String(column.value),
        displayName: String(column.name),
        required: false,
        defaultMatch: false,
        display: true,
        canBeUsedToMatch: true,
        type: 'options',
        options: targetOptions,
    }));
}
async function fetchResourceMapperFieldsForTables(context, schema, tableNameA, tableNameB) {
    const logMeta = {
        node: 'CollapsKeyColumnMapper',
        context: 'getMappingColumns()',
    };
    const [columnsA, columnsB] = await Promise.all([
        fetchTableColumns(context, schema, tableNameA, {
            ...logMeta,
            context: 'getMappingColumns() [Table A]',
        }),
        fetchTableColumns(context, schema, tableNameB, {
            ...logMeta,
            context: 'getMappingColumns() [Table B]',
        }),
    ]);
    if (columnsA.length === 0 || columnsB.length === 0) {
        return [];
    }
    return buildResourceMapperFields(columnsA, columnsB);
}
/** Direct SQL fetch without ILoadOptionsFunctions (execute-time fallback). */
async function fetchTableColumnsDirect(schema, tableName) {
    if (!(0, sqlValidation_1.isValidSqlIdentifier)(schema) || !(0, sqlValidation_1.isValidSqlIdentifier)(tableName)) {
        return [];
    }
    const safeSchema = (0, sqlValidation_1.assertValidSqlIdentifier)(schema, 'schema');
    const safeTable = (0, sqlValidation_1.assertValidSqlIdentifier)(tableName, 'tableName');
    const connection = (0, postgresClient_1.resolveConnectionConfig)({});
    return (0, postgresClient_1.withPostgresConnection)(connection, async (client) => {
        const result = await (0, collapsLogger_1.queryWithCollapsLog)(client, { node: 'loadOptionsPostgres', context: 'fetchTableColumnsDirect()' }, COLUMNS_SQL, [safeSchema, safeTable], (rows) => rows.map((row) => row.column_name));
        return result.rows
            .map((row) => row.column_name)
            .filter((column) => (0, sqlValidation_1.isValidSqlIdentifier)(column));
    });
}
