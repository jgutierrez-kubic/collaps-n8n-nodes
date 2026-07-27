import type { ILoadOptionsFunctions, INodePropertyOptions, ResourceMapperField } from 'n8n-workflow';
export declare function readCurrentNodeString(context: ILoadOptionsFunctions, parameterName: string, fallback?: string): string;
export declare function fetchTableNamesForSchema(context: ILoadOptionsFunctions, schema: string, logMeta: {
    node: string;
    context: string;
}): Promise<string[]>;
export declare function fetchTableColumns(context: ILoadOptionsFunctions, schema: string, tableName: string, logMeta?: {
    node: string;
    context: string;
}): Promise<string[]>;
export declare function toColumnPropertyOptions(columns: string[]): INodePropertyOptions[];
export declare function fetchColumnPropertyOptions(context: ILoadOptionsFunctions, schema: string, tableName: string, logMeta?: {
    node: string;
    context: string;
}): Promise<INodePropertyOptions[]>;
export declare function buildResourceMapperFields(columnsA: string[], columnsB: string[]): ResourceMapperField[];
export declare function fetchResourceMapperFieldsForTables(context: ILoadOptionsFunctions, schema: string, tableNameA: string, tableNameB: string): Promise<ResourceMapperField[]>;
/** Direct SQL fetch without ILoadOptionsFunctions (execute-time fallback). */
export declare function fetchTableColumnsDirect(schema: string, tableName: string): Promise<string[]>;
