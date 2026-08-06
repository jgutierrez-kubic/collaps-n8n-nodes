"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readPairLabelsFromMapperParameters = readPairLabelsFromMapperParameters;
exports.readCurrentNodeSelectedPairKeys = readCurrentNodeSelectedPairKeys;
exports.readMapperTableParams = readMapperTableParams;
exports.readMapperResourceMapperFields = readMapperResourceMapperFields;
const mapperResourceMapper_1 = require("./mapperResourceMapper");
const mapperUpstreamContext_1 = require("./mapperUpstreamContext");
const transformerPairing_1 = require("./transformerPairing");
function findParentKeyColumnMapper(context) {
    const parents = context.getParentNodes(context.getNode().name, {
        includeNodeParameters: true,
        depth: 12,
    });
    return parents.find((parent) => parent.type === 'collapsKeyColumnMapper' ||
        parent.type.endsWith('.collapsKeyColumnMapper'));
}
function pairsFromResourceMapperValue(mapping) {
    const value = mapping === null || mapping === void 0 ? void 0 : mapping.value;
    if (!value || typeof value !== 'object') {
        return [];
    }
    return Object.entries(value)
        .map(([columnA, columnB], index) => {
        const column_a = String(columnA).trim();
        const column_b = String(columnB !== null && columnB !== void 0 ? columnB : '').trim();
        if (!column_a || !column_b) {
            return null;
        }
        return {
            index,
            column_a,
            column_b,
            pair_label: (0, transformerPairing_1.buildPairLabel)(column_a, column_b),
        };
    })
        .filter((pair) => pair !== null);
}
async function readPairLabelsFromMapperParameters(context) {
    var _a, _b;
    const parentMapper = findParentKeyColumnMapper(context);
    const parameters = parentMapper === null || parentMapper === void 0 ? void 0 : parentMapper.parameters;
    if (parameters === null || parameters === void 0 ? void 0 : parameters.columnMapping) {
        const mappedPairs = pairsFromResourceMapperValue(parameters.columnMapping);
        if (mappedPairs.length > 0) {
            return mappedPairs;
        }
    }
    const { sideA, sideB } = await (0, mapperUpstreamContext_1.resolveMapperUpstreamContext)(context);
    const columnsA = (_a = sideA === null || sideA === void 0 ? void 0 : sideA.columns) !== null && _a !== void 0 ? _a : [];
    const columnsB = (_b = sideB === null || sideB === void 0 ? void 0 : sideB.columns) !== null && _b !== void 0 ? _b : [];
    if (columnsA.length === 0 || columnsB.length === 0) {
        return [];
    }
    return (0, transformerPairing_1.pairByIndex)(columnsA, columnsB).map((pair) => ({
        ...pair,
        pair_label: (0, transformerPairing_1.buildPairLabel)(pair.column_a, pair.column_b),
    }));
}
function readCurrentNodeSelectedPairKeys(context) {
    var _a;
    try {
        const raw = context.getCurrentNodeParameter('pairMethodAssignments');
        return ((_a = raw === null || raw === void 0 ? void 0 : raw.pairs) !== null && _a !== void 0 ? _a : [])
            .map((pair) => { var _a; return String((_a = pair.pairKey) !== null && _a !== void 0 ? _a : '').trim(); })
            .filter(Boolean);
    }
    catch {
        return [];
    }
}
async function readMapperTableParams(context) {
    var _a, _b, _c, _d, _e, _f;
    const { sideA, sideB } = await (0, mapperUpstreamContext_1.resolveMapperUpstreamContext)(context);
    return {
        schemaName: (_b = (_a = sideA === null || sideA === void 0 ? void 0 : sideA.schema) !== null && _a !== void 0 ? _a : sideB === null || sideB === void 0 ? void 0 : sideB.schema) !== null && _b !== void 0 ? _b : '',
        tableNameA: (_c = sideA === null || sideA === void 0 ? void 0 : sideA.tableName) !== null && _c !== void 0 ? _c : '',
        tableNameB: (_d = sideB === null || sideB === void 0 ? void 0 : sideB.tableName) !== null && _d !== void 0 ? _d : '',
        columnsA: (_e = sideA === null || sideA === void 0 ? void 0 : sideA.columns) !== null && _e !== void 0 ? _e : [],
        columnsB: (_f = sideB === null || sideB === void 0 ? void 0 : sideB.columns) !== null && _f !== void 0 ? _f : [],
    };
}
function readMapperResourceMapperFields(context) {
    const { result } = (0, mapperResourceMapper_1.resolveMapperResourceMapperFields)(context);
    return result.fields;
}
