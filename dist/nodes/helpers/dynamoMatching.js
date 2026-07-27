"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseStringList = parseStringList;
exports.parseMethodConfigs = parseMethodConfigs;
exports.buildDynamoColumnComparisons = buildDynamoColumnComparisons;
exports.buildBttfPayload = buildBttfPayload;
function parseStringList(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => String(entry).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return [];
        }
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.map((entry) => String(entry).trim()).filter(Boolean);
            }
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed.columns)) {
                return parsed.columns
                    .map((entry) => String(entry).trim())
                    .filter(Boolean);
            }
        }
        catch {
            // Fallback: lista separada por comas
        }
        return trimmed
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);
    }
    if (value && typeof value === 'object') {
        const record = value;
        if (Array.isArray(record.columns)) {
            return record.columns.map((entry) => String(entry).trim()).filter(Boolean);
        }
        if (Array.isArray(record.columnList)) {
            return record.columnList.map((entry) => String(entry).trim()).filter(Boolean);
        }
    }
    return [];
}
function parseMethodConfigs(value) {
    if (!value) {
        return [];
    }
    let rawValues = [];
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return [];
        }
        try {
            const parsed = JSON.parse(trimmed);
            rawValues = Array.isArray(parsed) ? parsed : [parsed];
        }
        catch {
            return [];
        }
    }
    else if (Array.isArray(value)) {
        rawValues = value;
    }
    else if (typeof value === 'object') {
        const record = value;
        if (Array.isArray(record.methods)) {
            rawValues = record.methods;
        }
        else if (record.method_id) {
            rawValues = [record];
        }
    }
    return rawValues
        .map((entry) => {
        if (!entry || typeof entry !== 'object') {
            return null;
        }
        const method = entry;
        const methodId = method.method_id;
        if (!methodId || typeof methodId !== 'string') {
            return null;
        }
        const options = method.options && typeof method.options === 'object'
            ? method.options
            : {};
        return {
            method_id: methodId,
            options,
        };
    })
        .filter((entry) => entry !== null);
}
/**
 * Dynamo Shortest List (columnas) + Longest List / Repeat Last (métodos).
 */
function buildDynamoColumnComparisons(colsA, colsB, methods) {
    if (colsA.length === 0 || colsB.length === 0 || methods.length === 0) {
        return [];
    }
    const pairCount = Math.min(colsA.length, colsB.length);
    const comparisons = [];
    for (let index = 0; index < pairCount; index++) {
        const method = methods[Math.min(index, methods.length - 1)];
        comparisons.push({
            column_a: colsA[index],
            column_b: colsB[index],
            method_id: method.method_id,
            options: method.options,
        });
    }
    return comparisons;
}
function buildBttfPayload(schemaName, tablaA, tablaB, llaveCruceA, llaveCruceB, columnComparisons, tablaDestino) {
    return {
        schema_name: schemaName,
        tabla_a: tablaA,
        tabla_b: tablaB,
        llave_cruce_a: llaveCruceA,
        llave_cruce_b: llaveCruceB,
        column_comparisons: columnComparisons,
        tabla_destino: tablaDestino,
    };
}
