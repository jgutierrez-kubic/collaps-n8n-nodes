"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPairLabel = buildPairLabel;
exports.toPairOutput = toPairOutput;
exports.toColumnsArray = toColumnsArray;
exports.firstColumn = firstColumn;
exports.parseColumnPairsFromInput = parseColumnPairsFromInput;
exports.toPairOptions = toPairOptions;
exports.pairByIndex = pairByIndex;
function buildPairLabel(columnA, columnB) {
    return `${columnA.toUpperCase()} / ${columnB.toUpperCase()}`;
}
function toPairOutput(columnA, columnB, index) {
    const column_a = columnA.trim();
    const column_b = columnB.trim();
    return {
        index: index !== null && index !== void 0 ? index : 0,
        pair_label: buildPairLabel(column_a, column_b),
        column_a,
        column_b,
    };
}
function toColumnsArray(columns) {
    if (Array.isArray(columns)) {
        const ordered = [];
        for (const column of columns) {
            const value = String(column).trim();
            if (value) {
                ordered.push(value);
            }
        }
        return ordered;
    }
    if (typeof columns === 'string') {
        return columns
            .split(',')
            .map((column) => column.trim())
            .filter(Boolean);
    }
    return [];
}
function firstColumn(columns) {
    var _a;
    const ordered = toColumnsArray(columns);
    return (_a = ordered[0]) !== null && _a !== void 0 ? _a : '';
}
function parseColumnPairsFromInput(input) {
    const rawPairs = input.column_pairs;
    if (Array.isArray(rawPairs) && rawPairs.length > 0) {
        return rawPairs
            .map((pair, index) => {
            var _a, _b, _c, _d;
            const pairData = pair;
            const column_a = String((_a = pairData.column_a) !== null && _a !== void 0 ? _a : '').trim();
            const column_b = String((_b = pairData.column_b) !== null && _b !== void 0 ? _b : '').trim();
            const pair_label = String((_c = pairData.pair_label) !== null && _c !== void 0 ? _c : '').trim() || buildPairLabel(column_a, column_b);
            return {
                index: Number((_d = pairData.index) !== null && _d !== void 0 ? _d : index),
                column_a,
                column_b,
                pair_label,
            };
        })
            .filter((pair) => pair.column_a && pair.column_b);
    }
    const bttfPayload = input.bttfPayload;
    if (!bttfPayload || typeof bttfPayload !== 'object' || Array.isArray(bttfPayload)) {
        return [];
    }
    const payload = bttfPayload;
    const columnasA = toColumnsArray(payload.columnas_a);
    const columnasB = toColumnsArray(payload.columnas_b);
    const pairCount = Math.min(columnasA.length, columnasB.length);
    const pairs = [];
    for (let index = 0; index < pairCount; index++) {
        const column_a = columnasA[index];
        const column_b = columnasB[index];
        pairs.push({
            index,
            column_a,
            column_b,
            pair_label: buildPairLabel(column_a, column_b),
        });
    }
    return pairs;
}
function toPairOptions(pairs) {
    return pairs.map((pair) => ({
        name: `Method for ${pair.pair_label}`,
        value: pair.pair_label,
        description: `${pair.column_a} ↔ ${pair.column_b}`,
    }));
}
function pairByIndex(columnsA, columnsB) {
    const pairCount = Math.min(columnsA.length, columnsB.length);
    const pairs = [];
    for (let index = 0; index < pairCount; index++) {
        const column_a = columnsA[index];
        const column_b = columnsB[index];
        pairs.push({
            index,
            column_a,
            column_b,
            pair_label: buildPairLabel(column_a, column_b),
        });
    }
    return pairs;
}
