import type { ILoadOptionsFunctions, INodePropertyOptions, ResourceMapperField } from 'n8n-workflow';
import { type PostgresCredentials } from './postgresClient';
export declare function readCurrentNodeString(context: ILoadOptionsFunctions, parameterName: string, fallback?: string): string;
export declare function fetchTableNamesForSchema(context: ILoadOptionsFunctions, schema: string, logMeta: {
    node: string;
    context: string;
}, connection?: PostgresCredentials): Promise<string[]>;
export declare function fetchTableColumns(context: ILoadOptionsFunctions, schema: string, tableName: string, logMeta?: {
    node: string;
    context: string;
}, connection?: PostgresCredentials): Promise<string[]>;
export declare function toColumnPropertyOptions(columns: string[]): INodePropertyOptions[];
export declare function fetchColumnPropertyOptions(context: ILoadOptionsFunctions, schema: string, tableName: string, logMeta?: {
    node: string;
    context: string;
}, connection?: PostgresCredentials): Promise<INodePropertyOptions[]>;
export declare function buildResourceMapperFields(columnsA: string[], columnsB: string[]): ResourceMapperField[];
export declare function fetchResourceMapperFieldsForTables(context: ILoadOptionsFunctions, schema: string, tableNameA: string, tableNameB: string): Promise<ResourceMapperField[]>;
