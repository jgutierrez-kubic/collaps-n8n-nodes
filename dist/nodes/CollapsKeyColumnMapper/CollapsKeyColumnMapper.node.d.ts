import type { IExecuteFunctions, ILoadOptionsFunctions, INodeExecutionData, INodeType, INodeTypeDescription, ResourceMapperFields } from 'n8n-workflow';
export declare class CollapsKeyColumnMapper implements INodeType {
    description: INodeTypeDescription;
    methods: {
        resourceMapping: {
            getMappingColumns(this: ILoadOptionsFunctions): Promise<ResourceMapperFields>;
        };
    };
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
