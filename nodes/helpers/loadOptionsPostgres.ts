import type { ILoadOptionsFunctions, INodePropertyOptions, ResourceMapperField } from 'n8n-workflow';

import { queryWithCollapsLog } from './collapsLogger';
import {
	DEFAULT_SELECTOR_SCHEMA,
	resolveConnectionConfig,
	withPostgresConnection,
	withPostgresClient,
} from './postgresClient';
import { assertValidSqlIdentifier, isValidSqlIdentifier } from './sqlValidation';

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

export function readCurrentNodeString(
	context: ILoadOptionsFunctions,
	parameterName: string,
	fallback = '',
): string {
	try {
		const value = context.getCurrentNodeParameter(parameterName);
		return String(value ?? fallback).trim();
	} catch {
		return fallback;
	}
}

export async function fetchTableNamesForSchema(
	context: ILoadOptionsFunctions,
	schema: string,
	logMeta: { node: string; context: string },
): Promise<string[]> {
	if (!isValidSqlIdentifier(schema)) {
		return [];
	}

	const safeSchema = assertValidSqlIdentifier(schema, 'schema');

	try {
		return await withPostgresClient(context, async (client) => {
			const result = await queryWithCollapsLog<{ table_name: string }>(
				client,
				logMeta,
				TABLES_SQL,
				[safeSchema],
				(rows) => rows.map((row) => row.table_name),
			);

			return result.rows
				.map((row) => row.table_name)
				.filter((tableName) => isValidSqlIdentifier(tableName));
		});
	} catch (error) {
		console.error('[loadOptionsPostgres] fetchTableNamesForSchema error:', error);
		return [];
	}
}

export async function fetchTableColumns(
	context: ILoadOptionsFunctions,
	schema: string,
	tableName: string,
	logMeta: { node: string; context: string } = {
		node: 'loadOptionsPostgres',
		context: 'fetchTableColumns()',
	},
): Promise<string[]> {
	if (!isValidSqlIdentifier(schema) || !isValidSqlIdentifier(tableName)) {
		return [];
	}

	const safeSchema = assertValidSqlIdentifier(schema, 'schema');
	const safeTable = assertValidSqlIdentifier(tableName, 'tableName');

	try {
		return await withPostgresClient(context, async (client) => {
			const result = await queryWithCollapsLog<{ column_name: string }>(
				client,
				logMeta,
				COLUMNS_SQL,
				[safeSchema, safeTable],
				(rows) => rows.map((row) => row.column_name),
			);

			return result.rows
				.map((row) => row.column_name)
				.filter((column) => isValidSqlIdentifier(column));
		});
	} catch (error) {
		console.error('[loadOptionsPostgres] fetchTableColumns error:', error);
		return [];
	}
}

export function toColumnPropertyOptions(columns: string[]): INodePropertyOptions[] {
	return columns
		.map((column) => column.trim())
		.filter((column) => isValidSqlIdentifier(column))
		.map((column) => ({
			name: column,
			value: column,
		}));
}

export async function fetchColumnPropertyOptions(
	context: ILoadOptionsFunctions,
	schema: string,
	tableName: string,
	logMeta?: { node: string; context: string },
): Promise<INodePropertyOptions[]> {
	const columns = await fetchTableColumns(context, schema, tableName, logMeta);
	return toColumnPropertyOptions(columns);
}

export function buildResourceMapperFields(
	columnsA: string[],
	columnsB: string[],
): ResourceMapperField[] {
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

export async function fetchResourceMapperFieldsForTables(
	context: ILoadOptionsFunctions,
	schema: string,
	tableNameA: string,
	tableNameB: string,
): Promise<ResourceMapperField[]> {
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
export async function fetchTableColumnsDirect(
	schema: string,
	tableName: string,
): Promise<string[]> {
	if (!isValidSqlIdentifier(schema) || !isValidSqlIdentifier(tableName)) {
		return [];
	}

	const safeSchema = assertValidSqlIdentifier(schema, 'schema');
	const safeTable = assertValidSqlIdentifier(tableName, 'tableName');
	const connection = resolveConnectionConfig({});

	return withPostgresConnection(connection, async (client) => {
		const result = await queryWithCollapsLog<{ column_name: string }>(
			client,
			{ node: 'loadOptionsPostgres', context: 'fetchTableColumnsDirect()' },
			COLUMNS_SQL,
			[safeSchema, safeTable],
			(rows) => rows.map((row) => row.column_name),
		);

		return result.rows
			.map((row) => row.column_name)
			.filter((column) => isValidSqlIdentifier(column));
	});
}
