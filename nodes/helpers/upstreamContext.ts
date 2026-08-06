import type { IDataObject, ILoadOptionsFunctions, INodeExecutionData } from 'n8n-workflow';

import { readTableNameFromJson, normalizeSelectedTableName } from './pickerUtils';
import { readCurrentNodeString } from './loadOptionsPostgres';
import { isValidSqlIdentifier } from './sqlValidation';

type LoadOptionsContext = ILoadOptionsFunctions & {
	getInputData?: () => INodeExecutionData[];
	getInputConnectionData?: (
		connectionType: string,
		inputIndex?: number,
	) => Promise<INodeExecutionData[] | null | undefined>;
};

function readHiddenNodeParameter(context: ILoadOptionsFunctions, name: string): string {
	const fromCurrent = readCurrentNodeString(context, name);
	if (fromCurrent && !fromCurrent.startsWith('={{')) {
		return fromCurrent;
	}

	try {
		return String(context.getNodeParameter(name, 0) ?? '').trim();
	} catch {
		return fromCurrent;
	}
}

export async function tryGetUpstreamJson(context: ILoadOptionsFunctions): Promise<IDataObject> {
	const contextWithInput = context as LoadOptionsContext;

	if (typeof contextWithInput.getInputData === 'function') {
		try {
			const items = contextWithInput.getInputData();
			if (Array.isArray(items) && items.length > 0) {
				return items[0]?.json ?? {};
			}
		} catch {
			// Fall through to connection-based lookup.
		}
	}

	if (typeof contextWithInput.getInputConnectionData === 'function') {
		try {
			const items = await contextWithInput.getInputConnectionData('main', 0);
			if (Array.isArray(items) && items.length > 0) {
				return items[0]?.json ?? {};
			}
		} catch {
			return {};
		}
	}

	return {};
}

function findParentNodeByType(
	context: ILoadOptionsFunctions,
	baseTypes: string[],
): { parameters?: IDataObject } | undefined {
	let parents: Array<{ type: string; parameters?: IDataObject }>;

	try {
		parents = context.getParentNodes(context.getNode().name, {
			includeNodeParameters: true,
			depth: 12,
		}) as Array<{ type: string; parameters?: IDataObject }>;
	} catch {
		return undefined;
	}

	return parents.find((parent) => {
		const type = String(parent.type ?? '');
		return baseTypes.some((base) => type === base || type.endsWith(`.${base}`));
	});
}

function findParentTableSelectorNode(
	context: ILoadOptionsFunctions,
): { parameters?: IDataObject } | undefined {
	return findParentNodeByType(context, ['collapsTableSelector', 'collapsTablePicker']);
}

export function readSchemaFromUpstreamInput(input: IDataObject): string {
	return readSchemaFromUpstreamInputStrict(input);
}

/** Design-time resolution: an absent upstream schema must stay empty so no query is attempted. */
export function readSchemaFromUpstreamInputStrict(input: IDataObject): string {
	const schema = String(input.selectedSchema ?? input.schema ?? '').trim();
	return isValidSqlIdentifier(schema) ? schema : '';
}

/**
 * Resolves the schema the Table Selector must list tables for.
 *
 * Order matters: the hidden expression parameter is the only source that survives the
 * design-time sandbox, the live input JSON covers pinned/executed data, and the parent
 * Schema Fetcher parameter is the last resort when nothing has run yet.
 */
export async function resolveSchemaForTableSelector(
	context: ILoadOptionsFunctions,
): Promise<string> {
	const fromHiddenParameter = readHiddenNodeParameter(context, 'upstreamSchema');
	if (isValidSqlIdentifier(fromHiddenParameter)) {
		return fromHiddenParameter;
	}

	const upstream = await tryGetUpstreamJson(context);
	const fromConnection = readSchemaFromUpstreamInputStrict(upstream);
	if (fromConnection) {
		return fromConnection;
	}

	const parentSchemaFetcher = findParentNodeByType(context, ['collapsSchemaFetcher']);
	const fromParentParameter = String(
		parentSchemaFetcher?.parameters?.selectedSchema ?? '',
	).trim();

	return isValidSqlIdentifier(fromParentParameter) ? fromParentParameter : '';
}

export function readValidatedTableNameFromInput(input: IDataObject): string {
	const candidate = readTableNameFromJson(input);
	return isValidSqlIdentifier(candidate) ? candidate : '';
}

export function readValidatedTableNameFromParameter(value: unknown): string {
	const candidate = normalizeSelectedTableName(value);
	return isValidSqlIdentifier(candidate) ? candidate : '';
}

export async function resolveTableNameForColumnSelector(
	context: ILoadOptionsFunctions,
): Promise<string> {
	const fromHiddenParameter = readValidatedTableNameFromParameter(
		readHiddenNodeParameter(context, 'upstreamTableName'),
	);
	if (fromHiddenParameter) {
		return fromHiddenParameter;
	}

	const upstream = await tryGetUpstreamJson(context);
	const fromConnection = readValidatedTableNameFromInput(upstream);
	if (fromConnection) {
		return fromConnection;
	}

	const parentTableSelector = findParentTableSelectorNode(context);
	const fromParentParameter = readValidatedTableNameFromParameter(
		parentTableSelector?.parameters?.tableName,
	);
	if (fromParentParameter) {
		return fromParentParameter;
	}

	return '';
}

export async function resolveSchemaForColumnSelector(
	context: ILoadOptionsFunctions,
): Promise<string> {
	const fromHiddenParameter = readHiddenNodeParameter(context, 'upstreamSchema');
	if (isValidSqlIdentifier(fromHiddenParameter)) {
		return fromHiddenParameter;
	}

	const upstream = await tryGetUpstreamJson(context);
	const fromConnection = readSchemaFromUpstreamInputStrict(upstream);
	if (fromConnection) {
		return fromConnection;
	}

	const parentTableSelector = findParentTableSelectorNode(context);
	const fromParentParameter = String(parentTableSelector?.parameters?.upstreamSchema ?? '').trim();

	return isValidSqlIdentifier(fromParentParameter) ? fromParentParameter : '';
}

export async function resolveContextForColumnSelector(
	context: ILoadOptionsFunctions,
): Promise<{ schema: string; tableName: string }> {
	const [schema, tableName] = await Promise.all([
		resolveSchemaForColumnSelector(context),
		resolveTableNameForColumnSelector(context),
	]);

	return { schema, tableName };
}
