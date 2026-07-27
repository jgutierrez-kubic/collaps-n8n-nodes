import type pg from 'pg';
export interface CollapsLogMeta {
    node: string;
    context: string;
    emittedData?: unknown;
}
export declare function logCollapsBlock(meta: CollapsLogMeta & {
    sql?: string;
    params?: unknown[];
    rowCount?: number;
    elapsedMs?: number;
    note?: string;
}): void;
export declare function queryWithCollapsLog<T extends pg.QueryResultRow>(client: pg.Client, meta: CollapsLogMeta, sql: string, params?: unknown[], emittedDataMapper?: (rows: T[]) => unknown): Promise<pg.QueryResult<T>>;
export declare function logCollapsOperation(node: string, context: string, emittedData: unknown, note?: string): void;
