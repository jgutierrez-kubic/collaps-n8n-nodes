import type { IDataObject, ILoadOptionsFunctions } from 'n8n-workflow';
export interface MapperBranchContext {
    schema: string;
    tableName: string;
    columns: string[];
}
export declare function tryGetUpstreamJsonAtInput(context: ILoadOptionsFunctions, inputIndex: number): Promise<IDataObject>;
export declare function resolveMapperUpstreamContext(context: ILoadOptionsFunctions): Promise<{
    sideA?: MapperBranchContext;
    sideB?: MapperBranchContext;
}>;
