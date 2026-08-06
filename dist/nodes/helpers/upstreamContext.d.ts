import type { IDataObject, ILoadOptionsFunctions } from 'n8n-workflow';
export declare function tryGetUpstreamJson(context: ILoadOptionsFunctions): Promise<IDataObject>;
export declare function readSchemaFromUpstreamInput(input: IDataObject): string;
/** Design-time resolution: an absent upstream schema must stay empty so no query is attempted. */
export declare function readSchemaFromUpstreamInputStrict(input: IDataObject): string;
/**
 * Resolves the schema the Table Selector must list tables for.
 *
 * Order matters: the hidden expression parameter is the only source that survives the
 * design-time sandbox, the live input JSON covers pinned/executed data, and the parent
 * Schema Fetcher parameter is the last resort when nothing has run yet.
 */
export declare function resolveSchemaForTableSelector(context: ILoadOptionsFunctions): Promise<string>;
export declare function readValidatedTableNameFromInput(input: IDataObject): string;
export declare function readValidatedTableNameFromParameter(value: unknown): string;
export declare function resolveTableNameForColumnSelector(context: ILoadOptionsFunctions): Promise<string>;
export declare function resolveSchemaForColumnSelector(context: ILoadOptionsFunctions): Promise<string>;
export declare function resolveContextForColumnSelector(context: ILoadOptionsFunctions): Promise<{
    schema: string;
    tableName: string;
}>;
