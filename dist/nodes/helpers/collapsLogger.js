"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logCollapsBlock = logCollapsBlock;
exports.queryWithCollapsLog = queryWithCollapsLog;
exports.logCollapsOperation = logCollapsOperation;
const LOG_ARRAY_PREVIEW_LIMIT = 10;
function normalizeSql(sql) {
    return sql.replace(/\s+/g, ' ').trim();
}
function formatTruncatedArray(arr) {
    if (arr.length <= LOG_ARRAY_PREVIEW_LIMIT) {
        return JSON.stringify(arr);
    }
    const preview = arr
        .slice(0, LOG_ARRAY_PREVIEW_LIMIT)
        .map((item) => JSON.stringify(item))
        .join(', ');
    return `[${preview}, ... (${arr.length} items leídos en total)]`;
}
function formatValueForLog(value) {
    if (Array.isArray(value)) {
        return formatTruncatedArray(value);
    }
    if (value !== null && typeof value === 'object') {
        const entries = Object.entries(value).map(([key, entry]) => {
            return `"${key}": ${formatValueForLog(entry)}`;
        });
        return `{${entries.join(', ')}}`;
    }
    return JSON.stringify(value);
}
function logCollapsBlock(meta) {
    var _a;
    const separator = '='.repeat(70);
    console.log(separator);
    console.log(`[COLLAPS LOG] Node: ${meta.node} | Context: ${meta.context}`);
    if (meta.note) {
        console.log(`[NOTE]: ${meta.note}`);
    }
    if (meta.sql) {
        console.log(`[SQL QUERY]: ${normalizeSql(meta.sql)}`);
        console.log(`[SQL PARAMS]: ${JSON.stringify((_a = meta.params) !== null && _a !== void 0 ? _a : [])}`);
    }
    if (meta.rowCount !== undefined && meta.elapsedMs !== undefined) {
        console.log(`[POSTGRES RESULT]: ${meta.rowCount} filas devueltas en ${meta.elapsedMs}ms.`);
    }
    if (meta.emittedData !== undefined) {
        console.log(`[DATA EMITTED]: ${formatValueForLog(meta.emittedData)}`);
    }
    console.log(separator);
}
async function queryWithCollapsLog(client, meta, sql, params, emittedDataMapper) {
    var _a;
    const startedAt = Date.now();
    const result = await client.query(sql, params);
    const emittedData = emittedDataMapper ? emittedDataMapper(result.rows) : meta.emittedData;
    logCollapsBlock({
        ...meta,
        sql,
        params,
        rowCount: (_a = result.rowCount) !== null && _a !== void 0 ? _a : result.rows.length,
        elapsedMs: Date.now() - startedAt,
        emittedData,
    });
    return result;
}
function logCollapsOperation(node, context, emittedData, note) {
    logCollapsBlock({
        node,
        context,
        emittedData,
        note,
    });
}
