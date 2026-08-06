import type { IDataObject, ILoadOptionsFunctions, INodeProperties } from 'n8n-workflow';
import type { PostgresCredentials } from './postgresClient';
export declare function resolveLoadOptionsConnection(context: ILoadOptionsFunctions): PostgresCredentials | null;
export declare function upstreamConnectionProperties(): INodeProperties[];
export declare function connectionFromInput(input: IDataObject): PostgresCredentials | null;
