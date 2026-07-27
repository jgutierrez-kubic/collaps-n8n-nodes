"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryGetUpstreamJson = tryGetUpstreamJson;
exports.readSchemaFromUpstreamInput = readSchemaFromUpstreamInput;
exports.readValidatedTableNameFromInput = readValidatedTableNameFromInput;
exports.readValidatedTableNameFromParameter = readValidatedTableNameFromParameter;
exports.resolveTableNameForColumnSelector = resolveTableNameForColumnSelector;
exports.resolveSchemaForColumnSelector = resolveSchemaForColumnSelector;
exports.resolveContextForColumnSelector = resolveContextForColumnSelector;
const pickerUtils_1 = require("./pickerUtils");
const loadOptionsPostgres_1 = require("./loadOptionsPostgres");
const postgresClient_1 = require("./postgresClient");
const sqlValidation_1 = require("./sqlValidation");
function readHiddenNodeParameter(context, name) {
    var _a;
    const fromCurrent = (0, loadOptionsPostgres_1.readCurrentNodeString)(context, name);
    if (fromCurrent && !fromCurrent.startsWith('={{')) {
        return fromCurrent;
    }
    try {
        return String((_a = context.getNodeParameter(name, 0)) !== null && _a !== void 0 ? _a : '').trim();
    }
    catch {
        return fromCurrent;
    }
}
async function tryGetUpstreamJson(context) {
    var _a, _b, _c, _d;
    const contextWithInput = context;
    if (typeof contextWithInput.getInputData === 'function') {
        try {
            const items = contextWithInput.getInputData();
            if (Array.isArray(items) && items.length > 0) {
                return (_b = (_a = items[0]) === null || _a === void 0 ? void 0 : _a.json) !== null && _b !== void 0 ? _b : {};
            }
        }
        catch {
            // Fall through to connection-based lookup.
        }
    }
    if (typeof contextWithInput.getInputConnectionData === 'function') {
        try {
            const items = await contextWithInput.getInputConnectionData('main', 0);
            if (Array.isArray(items) && items.length > 0) {
                return (_d = (_c = items[0]) === null || _c === void 0 ? void 0 : _c.json) !== null && _d !== void 0 ? _d : {};
            }
        }
        catch {
            return {};
        }
    }
    return {};
}
function findParentTableSelectorNode(context) {
    const parents = context.getParentNodes(context.getNode().name, {
        includeNodeParameters: true,
        depth: 12,
    });
    return parents.find((parent) => parent.type === 'collapsTableSelector' ||
        parent.type.endsWith('.collapsTableSelector') ||
        parent.type === 'collapsTablePicker' ||
        parent.type.endsWith('.collapsTablePicker'));
}
function readSchemaFromUpstreamInput(input) {
    var _a, _b;
    const schema = String((_b = (_a = input.schema) !== null && _a !== void 0 ? _a : input.selectedSchema) !== null && _b !== void 0 ? _b : postgresClient_1.DEFAULT_SELECTOR_SCHEMA).trim();
    return (0, sqlValidation_1.isValidSqlIdentifier)(schema) ? schema : postgresClient_1.DEFAULT_SELECTOR_SCHEMA;
}
function readValidatedTableNameFromInput(input) {
    const candidate = (0, pickerUtils_1.readTableNameFromJson)(input);
    return (0, sqlValidation_1.isValidSqlIdentifier)(candidate) ? candidate : '';
}
function readValidatedTableNameFromParameter(value) {
    const candidate = (0, pickerUtils_1.normalizeSelectedTableName)(value);
    return (0, sqlValidation_1.isValidSqlIdentifier)(candidate) ? candidate : '';
}
async function resolveTableNameForColumnSelector(context) {
    var _a;
    const fromHiddenParameter = readValidatedTableNameFromParameter(readHiddenNodeParameter(context, 'upstreamTableName'));
    if (fromHiddenParameter) {
        return fromHiddenParameter;
    }
    const upstream = await tryGetUpstreamJson(context);
    const fromConnection = readValidatedTableNameFromInput(upstream);
    if (fromConnection) {
        return fromConnection;
    }
    const parentTableSelector = findParentTableSelectorNode(context);
    const fromParentParameter = readValidatedTableNameFromParameter((_a = parentTableSelector === null || parentTableSelector === void 0 ? void 0 : parentTableSelector.parameters) === null || _a === void 0 ? void 0 : _a.tableName);
    if (fromParentParameter) {
        return fromParentParameter;
    }
    return '';
}
async function resolveSchemaForColumnSelector(context) {
    const fromHiddenParameter = readHiddenNodeParameter(context, 'upstreamSchema');
    if (fromHiddenParameter && (0, sqlValidation_1.isValidSqlIdentifier)(fromHiddenParameter)) {
        return fromHiddenParameter;
    }
    const upstream = await tryGetUpstreamJson(context);
    const fromConnection = readSchemaFromUpstreamInput(upstream);
    if (fromConnection) {
        return fromConnection;
    }
    return postgresClient_1.DEFAULT_SELECTOR_SCHEMA;
}
async function resolveContextForColumnSelector(context) {
    const [schema, tableName] = await Promise.all([
        resolveSchemaForColumnSelector(context),
        resolveTableNameForColumnSelector(context),
    ]);
    return { schema, tableName };
}
