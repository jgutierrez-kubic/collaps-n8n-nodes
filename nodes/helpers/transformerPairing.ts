import type { IDataObject, INodePropertyOptions } from 'n8n-workflow';

export interface ColumnPair {
	index: number;
	column_a: string;
	column_b: string;
	pair_label: string;
}

export function buildPairLabel(columnA: string, columnB: string): string {
	return `${columnA.toUpperCase()} / ${columnB.toUpperCase()}`;
}

export function toPairOutput(
	columnA: string,
	columnB: string,
	index?: number,
): { index: number; pair_label: string; column_a: string; column_b: string } {
	const column_a = columnA.trim();
	const column_b = columnB.trim();

	return {
		index: index ?? 0,
		pair_label: buildPairLabel(column_a, column_b),
		column_a,
		column_b,
	};
}

export function toColumnsArray(columns: unknown): string[] {
	if (Array.isArray(columns)) {
		const ordered: string[] = [];

		for (const column of columns) {
			const value = String(column).trim();
			if (value) {
				ordered.push(value);
			}
		}

		return ordered;
	}

	if (typeof columns === 'string') {
		return columns
			.split(',')
			.map((column) => column.trim())
			.filter(Boolean);
	}

	return [];
}

export function firstColumn(columns: unknown): string {
	const ordered = toColumnsArray(columns);
	return ordered[0] ?? '';
}

export function parseColumnPairsFromInput(input: IDataObject): ColumnPair[] {
	const rawPairs = input.column_pairs;

	if (Array.isArray(rawPairs) && rawPairs.length > 0) {
		return rawPairs
			.map((pair, index) => {
				const pairData = pair as IDataObject;
				const column_a = String(pairData.column_a ?? '').trim();
				const column_b = String(pairData.column_b ?? '').trim();
				const pair_label = String(pairData.pair_label ?? '').trim() || buildPairLabel(column_a, column_b);

				return {
					index: Number(pairData.index ?? index),
					column_a,
					column_b,
					pair_label,
				};
			})
			.filter((pair) => pair.column_a && pair.column_b);
	}

	const bttfPayload = input.bttfPayload;
	if (!bttfPayload || typeof bttfPayload !== 'object' || Array.isArray(bttfPayload)) {
		return [];
	}

	const payload = bttfPayload as IDataObject;
	const columnasA = toColumnsArray(payload.columnas_a);
	const columnasB = toColumnsArray(payload.columnas_b);
	const pairCount = Math.min(columnasA.length, columnasB.length);
	const pairs: ColumnPair[] = [];

	for (let index = 0; index < pairCount; index++) {
		const column_a = columnasA[index];
		const column_b = columnasB[index];
		pairs.push({
			index,
			column_a,
			column_b,
			pair_label: buildPairLabel(column_a, column_b),
		});
	}

	return pairs;
}

export function toPairOptions(pairs: ColumnPair[]): INodePropertyOptions[] {
	return pairs.map((pair) => ({
		name: `Method for ${pair.pair_label}`,
		value: pair.pair_label,
		description: `${pair.column_a} ↔ ${pair.column_b}`,
	}));
}

export function pairByIndex(columnsA: string[], columnsB: string[]): ColumnPair[] {
	const pairCount = Math.min(columnsA.length, columnsB.length);
	const pairs: ColumnPair[] = [];

	for (let index = 0; index < pairCount; index++) {
		const column_a = columnsA[index];
		const column_b = columnsB[index];
		pairs.push({
			index,
			column_a,
			column_b,
			pair_label: buildPairLabel(column_a, column_b),
		});
	}

	return pairs;
}
