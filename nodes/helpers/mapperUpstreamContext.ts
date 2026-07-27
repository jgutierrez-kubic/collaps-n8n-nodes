import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	NodeTypeAndVersion,
} from 'n8n-workflow';

import { parseColumnsInput } from './pickerUtils';
import { DEFAULT_SELECTOR_SCHEMA } from './postgresClient';
import {
	readSchemaFromUpstreamInput,
	readValidatedTableNameFromInput,
	readValidatedTableNameFromParameter,
} from './upstreamContext';
import { toColumnsArray } from './transformerPairing';
import { isValidSqlIdentifier } from './sqlValidation';

export interface MapperBranchContext {
	schema: string;
	tableName: string;
	columns: string[];
}

type LoadOptionsContext = ILoadOptionsFunctions & {
	getInputData?: (inputIndex?: number) => INodeExecutionData[];
	getInputConnectionData?: (
		connectionType: string,
		itemIndexOrInputIndex?: number,
		inputIndex?: number,
	) => Promise<INodeExecutionData[] | null | undefined>;
};

const COLUMN_SELECTOR_SUFFIX = '.collapsColumnSelector';
const TABLE_SELECTOR_SUFFIX = '.collapsTableSelector';
const SCHEMA_FETCHER_SUFFIX = '.collapsSchemaFetcher';

function isColumnSelectorType(type: string): boolean {
	return type === 'collapsColumnSelector' || type.endsWith(COLUMN_SELECTOR_SUFFIX);
}

function isTableSelectorType(type: string): boolean {
	return type === 'collapsTableSelector' || type.endsWith(TABLE_SELECTOR_SUFFIX);
}

function isSchemaFetcherType(type: string): boolean {
	return type === 'collapsSchemaFetcher' || type.endsWith(SCHEMA_FETCHER_SUFFIX);
}

function normalizeColumns(columns: unknown): string[] {
	return parseColumnsInput(columns).filter((column) => isValidSqlIdentifier(column));
}

function readBranchFromJson(json: IDataObject): MapperBranchContext | undefined {
	const tableName = readValidatedTableNameFromInput(json);
	if (!tableName) {
		return undefined;
	}

	return {
		schema: readSchemaFromUpstreamInput(json),
		tableName,
		columns: toColumnsArray(json.columns).filter((column) => isValidSqlIdentifier(column)),
	};
}

function readSchemaFromSelectorAncestors(
	context: ILoadOptionsFunctions,
	selectorNodeName: string,
): string {
	const ancestors = context.getParentNodes(selectorNodeName, {
		includeNodeParameters: true,
		depth: 3,
	});

	for (const ancestor of ancestors) {
		if (isSchemaFetcherType(ancestor.type)) {
			const selectedSchema = String(ancestor.parameters?.selectedSchema ?? '').trim();
			if (isValidSqlIdentifier(selectedSchema)) {
				return selectedSchema;
			}
		}
	}

	for (const ancestor of ancestors) {
		if (isTableSelectorType(ancestor.type)) {
			const parents = context.getParentNodes(ancestor.name, {
				includeNodeParameters: true,
				depth: 1,
			});
			for (const parent of parents) {
				if (isSchemaFetcherType(parent.type)) {
					const selectedSchema = String(parent.parameters?.selectedSchema ?? '').trim();
					if (isValidSqlIdentifier(selectedSchema)) {
						return selectedSchema;
					}
				}
			}
		}
	}

	return DEFAULT_SELECTOR_SCHEMA;
}

function readTableNameFromSelectorAncestors(
	context: ILoadOptionsFunctions,
	selectorNodeName: string,
): string {
	const ancestors = context.getParentNodes(selectorNodeName, {
		includeNodeParameters: true,
		depth: 2,
	});

	for (const ancestor of ancestors) {
		if (isTableSelectorType(ancestor.type)) {
			const tableName = readValidatedTableNameFromParameter(ancestor.parameters?.tableName);
			if (tableName) {
				return tableName;
			}
		}
	}

	return '';
}

function readBranchFromColumnSelectorNode(
	context: ILoadOptionsFunctions,
	selector: NodeTypeAndVersion,
): MapperBranchContext | undefined {
	const columns = normalizeColumns(selector.parameters?.columns);
	const tableName =
		readValidatedTableNameFromParameter(selector.parameters?.upstreamTableName) ||
		readTableNameFromSelectorAncestors(context, selector.name);

	if (!tableName) {
		return undefined;
	}

	return {
		schema: readSchemaFromSelectorAncestors(context, selector.name),
		tableName,
		columns,
	};
}

function mergeBranchContexts(
	primary: MapperBranchContext | undefined,
	fallback: MapperBranchContext | undefined,
): MapperBranchContext | undefined {
	if (!primary && !fallback) {
		return undefined;
	}

	const tableName = primary?.tableName || fallback?.tableName || '';
	if (!tableName) {
		return undefined;
	}

	const schema = primary?.schema || fallback?.schema || DEFAULT_SELECTOR_SCHEMA;
	const columns =
		primary?.columns && primary.columns.length > 0
			? primary.columns
			: fallback?.columns && fallback.columns.length > 0
				? fallback.columns
				: [];

	return {
		schema,
		tableName,
		columns,
	};
}

export async function tryGetUpstreamJsonAtInput(
	context: ILoadOptionsFunctions,
	inputIndex: number,
): Promise<IDataObject> {
	const contextWithInput = context as LoadOptionsContext;

	if (typeof contextWithInput.getInputData === 'function') {
		try {
			const items = contextWithInput.getInputData(inputIndex);
			if (Array.isArray(items) && items.length > 0) {
				return items[0]?.json ?? {};
			}
		} catch {
			// Fall through to connection-based lookup.
		}
	}

	if (typeof contextWithInput.getInputConnectionData === 'function') {
		try {
			const byExecuteSignature = await contextWithInput.getInputConnectionData('main', 0, inputIndex);
			if (Array.isArray(byExecuteSignature) && byExecuteSignature.length > 0) {
				return byExecuteSignature[0]?.json ?? {};
			}
		} catch {
			// Try alternate loadOptions signature below.
		}

		try {
			const byLoadOptionsSignature = await contextWithInput.getInputConnectionData('main', inputIndex);
			if (Array.isArray(byLoadOptionsSignature) && byLoadOptionsSignature.length > 0) {
				return byLoadOptionsSignature[0]?.json ?? {};
			}
		} catch {
			return {};
		}
	}

	return {};
}

function findDirectParentColumnSelectors(context: ILoadOptionsFunctions): NodeTypeAndVersion[] {
	const parents = context.getParentNodes(context.getNode().name, {
		includeNodeParameters: true,
		depth: 1,
	});

	return parents.filter((parent) => isColumnSelectorType(parent.type));
}

function findAllParentColumnSelectors(context: ILoadOptionsFunctions): NodeTypeAndVersion[] {
	const parents = context.getParentNodes(context.getNode().name, {
		includeNodeParameters: true,
		depth: 12,
	});

	return parents.filter((parent) => isColumnSelectorType(parent.type));
}

async function resolveBranchFromInputIndexes(
	context: ILoadOptionsFunctions,
	primaryInputIndex: number,
	fallbackInputIndex: number,
	orderedSelectors: NodeTypeAndVersion[],
): Promise<MapperBranchContext | undefined> {
	const [primaryJson, fallbackJson] = await Promise.all([
		tryGetUpstreamJsonAtInput(context, primaryInputIndex),
		tryGetUpstreamJsonAtInput(context, fallbackInputIndex),
	]);

	const fromConnection = mergeBranchContexts(
		readBranchFromJson(primaryJson),
		readBranchFromJson(fallbackJson),
	);

	const primarySelector = orderedSelectors[primaryInputIndex];
	const fallbackSelector = orderedSelectors[fallbackInputIndex];
	const fromParents = mergeBranchContexts(
		primarySelector ? readBranchFromColumnSelectorNode(context, primarySelector) : undefined,
		fallbackSelector ? readBranchFromColumnSelectorNode(context, fallbackSelector) : undefined,
	);

	return mergeBranchContexts(fromParents, fromConnection);
}

function resolveBranchesFromSelectorGroups(
	selectors: NodeTypeAndVersion[],
	context: ILoadOptionsFunctions,
): { sideA?: MapperBranchContext; sideB?: MapperBranchContext } {
	const branches = selectors
		.map((selector) => readBranchFromColumnSelectorNode(context, selector))
		.filter((branch): branch is MapperBranchContext => Boolean(branch?.tableName));

	const byTable = new Map<string, MapperBranchContext[]>();
	for (const branch of branches) {
		const group = byTable.get(branch.tableName) ?? [];
		group.push(branch);
		byTable.set(branch.tableName, group);
	}

	const tableNames = Array.from(byTable.keys()).sort();
	if (tableNames.length < 2) {
		return {};
	}

	const pickColumnsBranch = (group: MapperBranchContext[]): MapperBranchContext =>
		group.reduce((best, current) => (current.columns.length > best.columns.length ? current : best));

	return {
		sideA: pickColumnsBranch(byTable.get(tableNames[0]) ?? []),
		sideB: pickColumnsBranch(byTable.get(tableNames[1]) ?? []),
	};
}

export async function resolveMapperUpstreamContext(
	context: ILoadOptionsFunctions,
): Promise<{ sideA?: MapperBranchContext; sideB?: MapperBranchContext }> {
	const orderedSelectors = findDirectParentColumnSelectors(context);
	const allSelectors =
		orderedSelectors.length > 0 ? orderedSelectors : findAllParentColumnSelectors(context);

	const [sideA, sideB] = await Promise.all([
		resolveBranchFromInputIndexes(context, 1, 0, orderedSelectors),
		resolveBranchFromInputIndexes(context, 3, 2, orderedSelectors),
	]);

	if (sideA?.columns?.length && sideB?.columns?.length) {
		return { sideA, sideB };
	}

	const grouped = resolveBranchesFromSelectorGroups(allSelectors, context);
	return {
		sideA: sideA?.columns?.length ? sideA : grouped.sideA ?? sideA,
		sideB: sideB?.columns?.length ? sideB : grouped.sideB ?? sideB,
	};
}
