import type { IDataObject } from 'n8n-workflow';
import type { INodePropertyOptions } from 'n8n-workflow';

import { parseStringList } from './dynamoMatching';
import { isValidSqlIdentifier } from './sqlValidation';

export function readTableNameFromJson(input: IDataObject): string {
	const candidate = String(input.tableName ?? input.table_name ?? '').trim();
	return isValidSqlIdentifier(candidate) ? candidate : '';
}

export function normalizeSelectedTableName(value: unknown): string {
	let candidate = '';

	if (typeof value === 'string') {
		candidate = value.trim();
	} else if (value && typeof value === 'object') {
		const record = value as IDataObject;
		if (typeof record.value === 'string') {
			candidate = record.value.trim();
		} else if (typeof record.name === 'string') {
			candidate = record.name.trim();
		}
	} else if (value !== undefined && value !== null) {
		candidate = String(value).trim();
	}

	return isValidSqlIdentifier(candidate) ? candidate : '';
}

export function resolveTableNameFromSources(
	parameterValue: unknown,
	input: IDataObject,
): string {
	const fromParameter = normalizeSelectedTableName(parameterValue);
	if (fromParameter && !fromParameter.startsWith('={{')) {
		return fromParameter;
	}

	return readTableNameFromJson(input);
}

export function parseTablesInput(value: unknown): string[] {
	return parseStringList(value);
}

export function parseColumnsInput(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value
			.map((entry) => {
				if (typeof entry === 'string') {
					return entry.trim();
				}
				if (entry && typeof entry === 'object') {
					const record = entry as IDataObject;
					if (typeof record.name === 'string') {
						return record.name.trim();
					}
					if (typeof record.column_name === 'string') {
						return record.column_name.trim();
					}
				}
				return '';
			})
			.filter(Boolean);
	}

	return parseStringList(value);
}

export function toOptions(values: string[]): Array<{ name: string; value: string }> {
	return values.map((value) => ({
		name: value,
		value,
	}));
}

export function mergeColumnOptions(
	baseOptions: INodePropertyOptions[],
	...valueGroups: unknown[]
): INodePropertyOptions[] {
	const merged = new Map<string, INodePropertyOptions>();

	for (const option of baseOptions) {
		const value = String(option.value).trim();
		if (!value) {
			continue;
		}

		merged.set(value, {
			name: String(option.name ?? value),
			value,
		});
	}

	for (const group of valueGroups) {
		const values = parseColumnsInput(group);
		for (const value of values) {
			if (!merged.has(value)) {
				merged.set(value, { name: value, value });
			}
		}
	}

	return Array.from(merged.values());
}
