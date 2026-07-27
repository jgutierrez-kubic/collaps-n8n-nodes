import type { IDataObject } from 'n8n-workflow';
export interface MethodConfig {
    method_id: string;
    options: IDataObject;
}
export interface ColumnComparisonPair {
    column_a: string;
    column_b: string;
    method_id: string;
    options: IDataObject;
}
export interface BttfEnginePayload {
    schema_name: string;
    tabla_a: string;
    tabla_b: string;
    llave_cruce_a: string;
    llave_cruce_b: string;
    column_comparisons: ColumnComparisonPair[];
    tabla_destino: string;
}
export declare function parseStringList(value: unknown): string[];
export declare function parseMethodConfigs(value: unknown): MethodConfig[];
/**
 * Dynamo Shortest List (columnas) + Longest List / Repeat Last (métodos).
 */
export declare function buildDynamoColumnComparisons(colsA: string[], colsB: string[], methods: MethodConfig[]): ColumnComparisonPair[];
export declare function buildBttfPayload(schemaName: string, tablaA: string, tablaB: string, llaveCruceA: string, llaveCruceB: string, columnComparisons: ColumnComparisonPair[], tablaDestino: string): BttfEnginePayload;
