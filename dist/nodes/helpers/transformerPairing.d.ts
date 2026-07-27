import type { IDataObject, INodePropertyOptions } from 'n8n-workflow';
export interface ColumnPair {
    index: number;
    column_a: string;
    column_b: string;
    pair_label: string;
}
export declare function buildPairLabel(columnA: string, columnB: string): string;
export declare function toPairOutput(columnA: string, columnB: string, index?: number): {
    index: number;
    pair_label: string;
    column_a: string;
    column_b: string;
};
export declare function toColumnsArray(columns: unknown): string[];
export declare function firstColumn(columns: unknown): string;
export declare function parseColumnPairsFromInput(input: IDataObject): ColumnPair[];
export declare function toPairOptions(pairs: ColumnPair[]): INodePropertyOptions[];
export declare function pairByIndex(columnsA: string[], columnsB: string[]): ColumnPair[];
