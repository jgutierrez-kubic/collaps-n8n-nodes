import type { ILoadOptionsFunctions, ResourceMapperField, ResourceMapperFields } from 'n8n-workflow';
export declare function buildColumnMapResourceMapperFields(columnsA: string[], columnsB: string[]): ResourceMapperField[];
export declare function resolveMapperResourceMapperFields(context: ILoadOptionsFunctions): {
    result: ResourceMapperFields;
    debug: Record<string, unknown>;
};
