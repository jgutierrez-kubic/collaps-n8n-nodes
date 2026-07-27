import type { ILoadOptionsFunctions } from 'n8n-workflow';
import { buildResourceMapperFields } from './loadOptionsPostgres';
import { type ColumnPair } from './transformerPairing';
export declare function readPairLabelsFromMapperParameters(context: ILoadOptionsFunctions): Promise<ColumnPair[]>;
export declare function readCurrentNodeSelectedPairKeys(context: ILoadOptionsFunctions): string[];
export declare function readMapperTableParams(context: ILoadOptionsFunctions): Promise<{
    schemaName: string;
    tableNameA: string;
    tableNameB: string;
    columnsA: string[];
    columnsB: string[];
}>;
export declare function readMapperResourceMapperFields(context: ILoadOptionsFunctions): ReturnType<typeof buildResourceMapperFields>;
