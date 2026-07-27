import type { IDataObject } from 'n8n-workflow';

export interface MethodConfig {
	method_id: string;
	options: IDataObject;
}

export interface ColumnComparisonPair {
	column_a: string;
	column_b: string;
	method_id: string;
	options: IDataObject;
}

export interface BttfEnginePayload {
	schema_name: string;
	tabla_a: string;
	tabla_b: string;
	llave_cruce_a: string;
	llave_cruce_b: string;
	column_comparisons: ColumnComparisonPair[];
	tabla_destino: string;
}

export function parseStringList(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((entry) => String(entry).trim()).filter(Boolean);
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			return [];
		}

		try {
			const parsed = JSON.parse(trimmed) as unknown;
			if (Array.isArray(parsed)) {
				return parsed.map((entry) => String(entry).trim()).filter(Boolean);
			}
			if (parsed && typeof parsed === 'object' && Array.isArray((parsed as IDataObject).columns)) {
				return ((parsed as IDataObject).columns as unknown[])
					.map((entry) => String(entry).trim())
					.filter(Boolean);
			}
		} catch {
			// Fallback: lista separada por comas
		}

		return trimmed
			.split(',')
			.map((entry) => entry.trim())
			.filter(Boolean);
	}

	if (value && typeof value === 'object') {
		const record = value as IDataObject;
		if (Array.isArray(record.columns)) {
			return record.columns.map((entry) => String(entry).trim()).filter(Boolean);
		}
		if (Array.isArray(record.columnList)) {
			return record.columnList.map((entry) => String(entry).trim()).filter(Boolean);
		}
	}

	return [];
}

export function parseMethodConfigs(value: unknown): MethodConfig[] {
	if (!value) {
		return [];
	}

	let rawValues: unknown[] = [];

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			return [];
		}

		try {
			const parsed = JSON.parse(trimmed) as unknown;
			rawValues = Array.isArray(parsed) ? parsed : [parsed];
		} catch {
			return [];
		}
	} else if (Array.isArray(value)) {
		rawValues = value;
	} else if (typeof value === 'object') {
		const record = value as IDataObject;
		if (Array.isArray(record.methods)) {
			rawValues = record.methods as unknown[];
		} else if (record.method_id) {
			rawValues = [record];
		}
	}

	return rawValues
		.map((entry) => {
			if (!entry || typeof entry !== 'object') {
				return null;
			}

			const method = entry as IDataObject;
			const methodId = method.method_id;
			if (!methodId || typeof methodId !== 'string') {
				return null;
			}

			const options =
				method.options && typeof method.options === 'object'
					? (method.options as IDataObject)
					: {};

			return {
				method_id: methodId,
				options,
			};
		})
		.filter((entry): entry is MethodConfig => entry !== null);
}

/**
 * Dynamo Shortest List (columnas) + Longest List / Repeat Last (métodos).
 */
export function buildDynamoColumnComparisons(
	colsA: string[],
	colsB: string[],
	methods: MethodConfig[],
): ColumnComparisonPair[] {
	if (colsA.length === 0 || colsB.length === 0 || methods.length === 0) {
		return [];
	}

	const pairCount = Math.min(colsA.length, colsB.length);
	const comparisons: ColumnComparisonPair[] = [];

	for (let index = 0; index < pairCount; index++) {
		const method = methods[Math.min(index, methods.length - 1)];

		comparisons.push({
			column_a: colsA[index],
			column_b: colsB[index],
			method_id: method.method_id,
			options: method.options,
		});
	}

	return comparisons;
}

export function buildBttfPayload(
	schemaName: string,
	tablaA: string,
	tablaB: string,
	llaveCruceA: string,
	llaveCruceB: string,
	columnComparisons: ColumnComparisonPair[],
	tablaDestino: string,
): BttfEnginePayload {
	return {
		schema_name: schemaName,
		tabla_a: tablaA,
		tabla_b: tablaB,
		llave_cruce_a: llaveCruceA,
		llave_cruce_b: llaveCruceB,
		column_comparisons: columnComparisons,
		tabla_destino: tablaDestino,
	};
}
