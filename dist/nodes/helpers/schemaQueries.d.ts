import type pg from 'pg';
export declare function fetchRealSchemas(client: pg.Client, node?: string, context?: string): Promise<string[]>;
