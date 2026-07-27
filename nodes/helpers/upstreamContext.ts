import type { IDataObject, ILoadOptionsFunctions, INodeExecutionData } from 'n8n-workflow';

import { readTableNameFromJson, normalizeSelectedTableName } from './pickerUtils';
import { readCurrentNodeString } from './loadOptionsPostgres';
import { DEFAULT_SELECTOR_SCHEMA } from './postgresClient';
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

function findParentTableSelectorNode(
	context: ILoadOptionsFunctions,
): { parameters?: IDataObject } | undefined {
	const parents = context.getParentNodes(context.getNode().name, {
		includeNodeParameters: true,
		depth: 12,
	});

	return parents.find(
		(parent) =>
			parent.type === 'collapsTableSelector' ||
			parent.type.endsWith('.collapsTableSelector') ||
			parent.type === 'collapsTablePicker' ||
			parent.type.endsWith('.collapsTablePicker'),
	) as { parameters?: IDataObject } | undefined;
}

export function readSchemaFromUpstreamInput(input: IDataObject): string {
	const schema = String(input.schema ?? input.selectedSchema ?? DEFAULT_SELECTOR_SCHEMA).trim();
	return isValidSqlIdentifier(schema) ? schema : DEFAULT_SELECTOR_SCHEMA;
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
	if (fromHiddenParameter && isValidSqlIdentifier(fromHiddenParameter)) {
		return fromHiddenParameter;
	}

	const upstream = await tryGetUpstreamJson(context);
	const fromConnection = readSchemaFromUpstreamInput(upstream);
	if (fromConnection) {
		return fromConnection;
	}

	return DEFAULT_SELECTOR_SCHEMA;
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
