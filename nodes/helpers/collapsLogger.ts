import type pg from 'pg';

export interface CollapsLogMeta {
	node: string;
	context: string;
	emittedData?: unknown;
}

const LOG_ARRAY_PREVIEW_LIMIT = 10;

function normalizeSql(sql: string): string {
	return sql.replace(/\s+/g, ' ').trim();
}

function formatTruncatedArray(arr: unknown[]): string {
	if (arr.length <= LOG_ARRAY_PREVIEW_LIMIT) {
		return JSON.stringify(arr);
	}

	const preview = arr
		.slice(0, LOG_ARRAY_PREVIEW_LIMIT)
		.map((item) => JSON.stringify(item))
		.join(', ');

	return `[${preview}, ... (${arr.length} items leídos en total)]`;
}

function formatValueForLog(value: unknown): string {
	if (Array.isArray(value)) {
		return formatTruncatedArray(value);
	}

	if (value !== null && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
			return `"${key}": ${formatValueForLog(entry)}`;
		});

		return `{${entries.join(', ')}}`;
	}

	return JSON.stringify(value);
}

export function logCollapsBlock(
	meta: CollapsLogMeta & {
		sql?: string;
		params?: unknown[];
		rowCount?: number;
		elapsedMs?: number;
		note?: string;
	},
): void {
	const separator = '='.repeat(70);

	console.log(separator);
	console.log(`[COLLAPS LOG] Node: ${meta.node} | Context: ${meta.context}`);

	if (meta.note) {
		console.log(`[NOTE]: ${meta.note}`);
	}

	if (meta.sql) {
		console.log(`[SQL QUERY]: ${normalizeSql(meta.sql)}`);
		console.log(`[SQL PARAMS]: ${JSON.stringify(meta.params ?? [])}`);
	}

	if (meta.rowCount !== undefined && meta.elapsedMs !== undefined) {
		console.log(`[POSTGRES RESULT]: ${meta.rowCount} filas devueltas en ${meta.elapsedMs}ms.`);
	}

	if (meta.emittedData !== undefined) {
		console.log(`[DATA EMITTED]: ${formatValueForLog(meta.emittedData)}`);
	}

	console.log(separator);
}

export async function queryWithCollapsLog<T extends pg.QueryResultRow>(
	client: pg.Client,
	meta: CollapsLogMeta,
	sql: string,
	params?: unknown[],
	emittedDataMapper?: (rows: T[]) => unknown,
): Promise<pg.QueryResult<T>> {
	const startedAt = Date.now();
	const result = await client.query<T>(sql, params);
	const emittedData = emittedDataMapper ? emittedDataMapper(result.rows) : meta.emittedData;

	logCollapsBlock({
		...meta,
		sql,
		params,
		rowCount: result.rowCount ?? result.rows.length,
		elapsedMs: Date.now() - startedAt,
		emittedData,
	});

	return result;
}

export function logCollapsOperation(
	node: string,
	context: string,
	emittedData: unknown,
	note?: string,
): void {
	logCollapsBlock({
		node,
		context,
		emittedData,
		note,
	});
}
