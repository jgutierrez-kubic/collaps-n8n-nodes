import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import type pg from 'pg';

import { logCollapsOperation, queryWithCollapsLog } from '../helpers/collapsLogger';
import {
	connectionFromInput,
	upstreamConnectionProperties,
} from '../helpers/loadOptionsConnection';
import {
	quoteIdentifier,
	resolveConnectionConfig,
	withPostgresConnection,
	type PostgresCredentials,
} from '../helpers/postgresClient';
import { isValidSqlIdentifier } from '../helpers/sqlValidation';

const NODE_NAME = 'CollapsColumnHeaderTransposer';

const COLUMNS_SQL = `
	SELECT column_name
	FROM information_schema.columns
	WHERE table_catalog = current_database()
		AND table_schema = $1
		AND table_name = $2
	ORDER BY ordinal_position
`;

interface OperationSummary {
	status: 'success';
	source_table: string;
	target_table: string;
	target_column: string;
	columns_detected: number;
	new_columns: number;
	updated_columns: number;
	deprecated_columns: number;
}

interface TableContext {
	schema: string;
	tableName: string;
}

function readResolvedParameter(
	context: IExecuteFunctions,
	name: string,
	itemIndex: number,
): string {
	const value = String(context.getNodeParameter(name, itemIndex, '') ?? '').trim();
	return value.startsWith('=') || value.includes('{{') ? '' : value;
}

function resolveExecuteConnection(
	context: IExecuteFunctions,
	itemIndex: number,
	input: IDataObject,
): PostgresCredentials | null {
	const fromInput = connectionFromInput(input) ?? resolveConnectionConfig(input);
	if (fromInput) {
		return fromInput;
	}

	return resolveConnectionConfig(
		{},
		{
			host: readResolvedParameter(context, 'connectionHost', itemIndex),
			port: Number(context.getNodeParameter('connectionPort', itemIndex, 0)),
			database: readResolvedParameter(context, 'connectionDatabase', itemIndex),
			user: readResolvedParameter(context, 'connectionUser', itemIndex),
			password: readResolvedParameter(context, 'connectionPassword', itemIndex),
		},
	);
}

function readTableContext(input: IDataObject): TableContext | null {
	const schema = String(input.schema ?? input.schemaName ?? input.selectedSchema ?? '').trim();
	const tableName = String(input.tableName ?? input.sourceTable ?? '').trim();

	if (!isValidSqlIdentifier(schema) || !isValidSqlIdentifier(tableName)) {
		return null;
	}

	return { schema, tableName };
}

function readFirstColumn(input: IDataObject): string {
	const columns = Array.isArray(input.columns) ? input.columns : [];
	const column = String(columns[0] ?? '').trim();
	return isValidSqlIdentifier(column) ? column : '';
}

async function fetchColumnNames(
	client: pg.Client,
	schema: string,
	tableName: string,
): Promise<string[]> {
	const result = await queryWithCollapsLog<{ column_name: string }>(
		client,
		{ node: NODE_NAME, context: 'fetchColumnNames()' },
		COLUMNS_SQL,
		[schema, tableName],
		(rows) => rows.map((row) => row.column_name),
	);

	return result.rows
		.map((row) => row.column_name)
		.filter((column) => isValidSqlIdentifier(column));
}

async function fetchSampleValue(
	client: pg.Client,
	schema: string,
	tableName: string,
	column: string,
): Promise<unknown> {
	const qualifiedTable = `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`;
	const qualifiedColumn = quoteIdentifier(column);

	try {
		const result = await client.query(
			`SELECT ${qualifiedColumn} AS sample_value FROM ${qualifiedTable} LIMIT 1`,
		);
		return result.rows[0]?.sample_value ?? null;
	} catch {
		return null;
	}
}

async function synchronizeStructureLog(
	client: pg.Client,
	sourceSchema: string,
	sourceTable: string,
	targetSchema: string,
	targetTable: string,
	targetColumn: string,
): Promise<OperationSummary> {
	const sourceColumns = await fetchColumnNames(client, sourceSchema, sourceTable);
	const targetColumns = new Set(
		await fetchColumnNames(client, targetSchema, targetTable),
	);
	const requiredTargetColumns = [
		'tabla',
		'columna_origen',
		targetColumn,
		'valor_ejemplo',
		'fecha_ultima_recepcion',
		'vigente',
	];
	const missingTargetColumns = requiredTargetColumns.filter(
		(column) => !targetColumns.has(column),
	);
	if (missingTargetColumns.length > 0) {
		throw new Error(
			`Target table ${targetSchema}.${targetTable} is missing required columns: ${[...new Set(missingTargetColumns)].join(', ')}.`,
		);
	}
	if (
		['tabla', 'valor_ejemplo', 'fecha_ultima_recepcion', 'vigente'].includes(
			targetColumn,
		)
	) {
		throw new Error(
			`Target column "${targetColumn}" is reserved for automatic metadata.`,
		);
	}

	const qualifiedTarget = `${quoteIdentifier(targetSchema)}.${quoteIdentifier(targetTable)}`;
	const existingResult = await client.query<{ columna_origen: unknown }>(
		`SELECT columna_origen FROM ${qualifiedTarget} WHERE tabla = $1`,
		[sourceTable],
	);
	const existingColumns = new Set(
		existingResult.rows.map((row) => String(row.columna_origen ?? '')),
	);
	const newColumns = sourceColumns.filter((column) => !existingColumns.has(column)).length;
	const updatedColumns = sourceColumns.length - newColumns;
	const deprecatedResult = await client.query(
		`UPDATE ${qualifiedTarget}
		 SET vigente = FALSE
		 WHERE tabla = $1
		   AND vigente IS DISTINCT FROM FALSE
		   AND NOT (columna_origen = ANY($2::text[]))`,
		[sourceTable, sourceColumns],
	);

	for (const column of sourceColumns) {
		const sampleValue = await fetchSampleValue(
			client,
			sourceSchema,
			sourceTable,
			column,
		);

		const insertColumns = ['tabla', 'columna_origen'];
		const valueExpressions = ['$1', '$2'];
		const values: unknown[] = [sourceTable, column];
		const updateAssignments: string[] = [];

		if (targetColumn !== 'columna_origen') {
			insertColumns.push(targetColumn);
			values.push(column);
			valueExpressions.push(`$${values.length}`);
			updateAssignments.push(
				`${quoteIdentifier(targetColumn)} = EXCLUDED.${quoteIdentifier(targetColumn)}`,
			);
		}

		insertColumns.push(
			'valor_ejemplo',
			'fecha_ultima_recepcion',
			'vigente',
		);
		values.push(sampleValue);
		valueExpressions.push(`$${values.length}`, 'NOW()', 'TRUE');
		updateAssignments.push(
			'valor_ejemplo = EXCLUDED.valor_ejemplo',
			'fecha_ultima_recepcion = NOW()',
			'vigente = TRUE',
		);

		await client.query(
			`INSERT INTO ${qualifiedTarget}
				(${insertColumns.map(quoteIdentifier).join(', ')})
			 VALUES (${valueExpressions.join(', ')})
			 ON CONFLICT (tabla, columna_origen) DO UPDATE SET
				${updateAssignments.join(', ')}`,
			values,
		);
	}

	return {
		status: 'success',
		source_table: sourceTable,
		target_table: targetTable,
		target_column: targetColumn,
		columns_detected: sourceColumns.length,
		new_columns: newColumns,
		updated_columns: updatedColumns,
		deprecated_columns: deprecatedResult.rowCount ?? 0,
	};
}

export class CollapsColumnHeaderTransposer implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'COLLAPS Column Header Transposer',
		name: 'collapsColumnHeaderTransposer',
		icon: 'fa:th-list',
		group: ['transform'],
		version: 1,
		subtitle: '3-input active transposer',
		description:
			'Maps source-table headers into a selected target column and persists them directly in PostgreSQL.',
		defaults: {
			name: 'COLLAPS Column Header Transposer',
		},
		inputs: [
			{ displayName: 'Source Table', type: NodeConnectionTypes.Main },
			{ displayName: 'Target Table', type: NodeConnectionTypes.Main },
			{ displayName: 'Target Column', type: NodeConnectionTypes.Main },
		],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			...upstreamConnectionProperties(),
			{
				displayName: 'Structure Sensor',
				name: 'structureNotice',
				type: 'notice',
				default: '',
				description:
					'Conecte Source Table, Target Table y Target Column. El nodo detectará los headers y los escribirá directamente.',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const itemIndex = 0;

		try {
			const sourceInput = this.getInputData(0)[0]?.json;
			const targetInput = this.getInputData(1)[0]?.json;
			const columnInput = this.getInputData(2)[0]?.json;
			const source = sourceInput ? readTableContext(sourceInput) : null;
			const target = targetInput ? readTableContext(targetInput) : null;
			const columnTable = columnInput ? readTableContext(columnInput) : null;
			const targetColumn = columnInput ? readFirstColumn(columnInput) : '';

			if (!source || !target || !columnTable || !targetColumn) {
				throw new Error('Falta configuración de Origen, Destino o Columna');
			}
			if (
				columnTable.schema !== target.schema ||
				columnTable.tableName !== target.tableName
			) {
				throw new Error(
					'La Columna Destino debe provenir de la misma Tabla Destino.',
				);
			}

			const connection = resolveExecuteConnection(this, itemIndex, sourceInput ?? {});
			if (!connection) {
				throw new Error(
					'No se recibieron credenciales válidas desde COLLAPS Database Connection.',
				);
			}

			const summary = await withPostgresConnection(connection, async (client) => {
				await client.query('BEGIN');
				try {
					const result = await synchronizeStructureLog(
						client,
						source.schema,
						source.tableName,
						target.schema,
						target.tableName,
						targetColumn,
					);
					await client.query('COMMIT');
					return result;
				} catch (error) {
					await client.query('ROLLBACK');
					throw error;
				}
			});

			logCollapsOperation(
				NODE_NAME,
				'execute()',
				summary,
				`Headers synchronized from ${source.schema}.${source.tableName} into ${target.schema}.${target.tableName}.${targetColumn}.`,
			);

			return [
				[
					{
						json: summary as unknown as IDataObject,
						pairedItem: { item: itemIndex },
					},
				],
			];
		} catch (error) {
			throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
		}
	}
}
