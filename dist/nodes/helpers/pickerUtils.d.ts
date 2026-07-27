import type { IDataObject } from 'n8n-workflow';
import type { INodePropertyOptions } from 'n8n-workflow';
export declare function readTableNameFromJson(input: IDataObject): string;
export declare function normalizeSelectedTableName(value: unknown): string;
export declare function resolveTableNameFromSources(parameterValue: unknown, input: IDataObject): string;
export declare function parseTablesInput(value: unknown): string[];
export declare function parseColumnsInput(value: unknown): string[];
export declare function toOptions(values: string[]): Array<{
    name: string;
    value: string;
}>;
export declare function mergeColumnOptions(baseOptions: INodePropertyOptions[], ...valueGroups: unknown[]): INodePropertyOptions[];
