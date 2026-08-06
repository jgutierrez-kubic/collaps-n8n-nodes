import type { IDataObject } from 'n8n-workflow';
import type { ILoadOptionsFunctions } from 'n8n-workflow';
import pg from 'pg';
export { logCollapsBlock, logCollapsOperation, queryWithCollapsLog } from './collapsLogger';
export interface PostgresCredentials {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: pg.ClientConfig['ssl'];
}
export declare function resolveConnectionConfig(input?: IDataObject, overrides?: Partial<PostgresCredentials>): PostgresCredentials | null;
export declare function toPostgresError(error: unknown): Error;
export declare function withPostgresConnection<T>(connection: PostgresCredentials, fn: (client: pg.Client) => Promise<T>): Promise<T>;
export declare function withPostgresClient<T>(_context: ILoadOptionsFunctions, fn: (client: pg.Client) => Promise<T>, connectionOverride?: PostgresCredentials): Promise<T>;
export declare function resolveSchema(schema?: string): string;
export declare function resolveSelectorSchema(schema?: string): string;
export declare function resolveSchemaFromStream(schemaParam: string | undefined, input: IDataObject): string;
export declare function quoteIdentifier(identifier: string): string;
