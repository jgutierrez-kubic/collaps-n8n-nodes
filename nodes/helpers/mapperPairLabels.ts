import type { ILoadOptionsFunctions, ResourceMapperValue } from 'n8n-workflow';

import { buildResourceMapperFields } from './loadOptionsPostgres';
import { resolveMapperResourceMapperFields } from './mapperResourceMapper';
import { resolveMapperUpstreamContext } from './mapperUpstreamContext';
import { DEFAULT_SELECTOR_SCHEMA } from './postgresClient';
import { buildPairLabel, pairByIndex, type ColumnPair } from './transformerPairing';

function findParentKeyColumnMapper(
	context: ILoadOptionsFunctions,
): { parameters?: Record<string, unknown> } | undefined {
	const parents = context.getParentNodes(context.getNode().name, {
		includeNodeParameters: true,
		depth: 12,
	});

	return parents.find(
		(parent) =>
			parent.type === 'collapsKeyColumnMapper' ||
			parent.type.endsWith('.collapsKeyColumnMapper'),
	) as { parameters?: Record<string, unknown> } | undefined;
}

function pairsFromResourceMapperValue(mapping: ResourceMapperValue | undefined): ColumnPair[] {
	const value = mapping?.value;
	if (!value || typeof value !== 'object') {
		return [];
	}

	return Object.entries(value)
		.map(([columnA, columnB], index) => {
			const column_a = String(columnA).trim();
			const column_b = String(columnB ?? '').trim();
			if (!column_a || !column_b) {
				return null;
			}

			return {
				index,
				column_a,
				column_b,
				pair_label: buildPairLabel(column_a, column_b),
			};
		})
		.filter((pair): pair is ColumnPair => pair !== null);
}

export async function readPairLabelsFromMapperParameters(
	context: ILoadOptionsFunctions,
): Promise<ColumnPair[]> {
	const parentMapper = findParentKeyColumnMapper(context);
	const parameters = parentMapper?.parameters;

	if (parameters?.columnMapping) {
		const mappedPairs = pairsFromResourceMapperValue(
			parameters.columnMapping as ResourceMapperValue,
		);
		if (mappedPairs.length > 0) {
			return mappedPairs;
		}
	}

	const { sideA, sideB } = await resolveMapperUpstreamContext(context);
	const columnsA = sideA?.columns ?? [];
	const columnsB = sideB?.columns ?? [];

	if (columnsA.length === 0 || columnsB.length === 0) {
		return [];
	}

	return pairByIndex(columnsA, columnsB).map((pair) => ({
		...pair,
		pair_label: buildPairLabel(pair.column_a, pair.column_b),
	}));
}

export function readCurrentNodeSelectedPairKeys(context: ILoadOptionsFunctions): string[] {
	try {
		const raw = context.getCurrentNodeParameter('pairMethodAssignments') as {
			pairs?: Array<{ pairKey?: string }>;
		};

		return (raw?.pairs ?? [])
			.map((pair) => String(pair.pairKey ?? '').trim())
			.filter(Boolean);
	} catch {
		return [];
	}
}

export async function readMapperTableParams(context: ILoadOptionsFunctions): Promise<{
	schemaName: string;
	tableNameA: string;
	tableNameB: string;
	columnsA: string[];
	columnsB: string[];
}> {
	const { sideA, sideB } = await resolveMapperUpstreamContext(context);

	return {
		schemaName: sideA?.schema ?? sideB?.schema ?? DEFAULT_SELECTOR_SCHEMA,
		tableNameA: sideA?.tableName ?? '',
		tableNameB: sideB?.tableName ?? '',
		columnsA: sideA?.columns ?? [],
		columnsB: sideB?.columns ?? [],
	};
}

export function readMapperResourceMapperFields(
	context: ILoadOptionsFunctions,
): ReturnType<typeof buildResourceMapperFields> {
	const { result } = resolveMapperResourceMapperFields(context);
	return result.fields;
}
