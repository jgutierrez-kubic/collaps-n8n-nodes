import type { ILoadOptionsFunctions, ResourceMapperField, ResourceMapperFields } from 'n8n-workflow';

import { logCollapsOperation } from './collapsLogger';
import { isValidSqlIdentifier } from './sqlValidation';

const NODE_NAME = 'CollapsKeyColumnMapper';

function readHiddenCsvParameter(context: ILoadOptionsFunctions, parameterName: string): string {
	try {
		const raw = context.getCurrentNodeParameter(parameterName);
		const value = String(raw ?? '').trim();
		if (!value || value.startsWith('={{')) {
			return '';
		}
		return value;
	} catch {
		return '';
	}
}

function parseColumnsCsv(csv: string): string[] {
	if (!csv) {
		return [];
	}

	return csv
		.split(',')
		.map((column) => column.trim())
		.filter((column) => isValidSqlIdentifier(column));
}

export function buildColumnMapResourceMapperFields(
	columnsA: string[],
	columnsB: string[],
): ResourceMapperField[] {
	if (columnsA.length === 0 || columnsB.length === 0) {
		return [];
	}

	const targetOptions = columnsB.map((column) => ({
		name: column,
		value: column,
	}));

	return columnsA.map((columnA) => ({
		id: columnA,
		displayName: columnA,
		required: false,
		defaultMatch: false,
		display: true,
		canBeUsedToMatch: true,
		type: 'options' as const,
		options: targetOptions,
	}));
}

export function resolveMapperResourceMapperFields(
	context: ILoadOptionsFunctions,
): { result: ResourceMapperFields; debug: Record<string, unknown> } {
	logCollapsOperation(
		NODE_NAME,
		'getMappingColumns()',
		{ status: 'ENTRY', node: context.getNode().name },
		'Hook resourceMapper iniciado (expression bypass).',
	);

	const colsAStr = readHiddenCsvParameter(context, 'upstreamColumnsA_csv');
	const colsBStr = readHiddenCsvParameter(context, 'upstreamColumnsB_csv');

	const columnsA = parseColumnsCsv(colsAStr);
	const columnsB = parseColumnsCsv(colsBStr);
	const fields = buildColumnMapResourceMapperFields(columnsA, columnsB);

	const debug = {
		upstreamColumnsA_csv: colsAStr,
		upstreamColumnsB_csv: colsBStr,
		columnsA,
		columnsB,
		columnsACount: columnsA.length,
		columnsBCount: columnsB.length,
		fieldsCount: fields.length,
		fieldIds: fields.map((field) => field.id),
	};

	logCollapsOperation(
		NODE_NAME,
		'getMappingColumns()',
		debug,
		'Columnas resueltas desde parámetros ocultos antes de retornar fields.',
	);

	const result: ResourceMapperFields = { fields };

	logCollapsOperation(
		NODE_NAME,
		'getMappingColumns()',
		{
			returnShape: 'ResourceMapperFields',
			fieldsCount: result.fields.length,
			firstField: result.fields[0] ?? null,
		},
		'Retorno final del resourceMapper.',
	);

	return { result, debug };
}
