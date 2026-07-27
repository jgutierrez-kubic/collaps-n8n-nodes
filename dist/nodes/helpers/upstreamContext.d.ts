import type { IDataObject, ILoadOptionsFunctions } from 'n8n-workflow';
export declare function tryGetUpstreamJson(context: ILoadOptionsFunctions): Promise<IDataObject>;
export declare function readSchemaFromUpstreamInput(input: IDataObject): string;
export declare function readValidatedTableNameFromInput(input: IDataObject): string;
export declare function readValidatedTableNameFromParameter(value: unknown): string;
export declare function resolveTableNameForColumnSelector(context: ILoadOptionsFunctions): Promise<string>;
export declare function resolveSchemaForColumnSelector(context: ILoadOptionsFunctions): Promise<string>;
export declare function resolveContextForColumnSelector(context: ILoadOptionsFunctions): Promise<{
    schema: string;
    tableName: string;
}>;
