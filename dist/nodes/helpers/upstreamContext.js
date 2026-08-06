"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryGetUpstreamJson = tryGetUpstreamJson;
exports.readSchemaFromUpstreamInput = readSchemaFromUpstreamInput;
exports.readSchemaFromUpstreamInputStrict = readSchemaFromUpstreamInputStrict;
exports.resolveSchemaForTableSelector = resolveSchemaForTableSelector;
exports.readValidatedTableNameFromInput = readValidatedTableNameFromInput;
exports.readValidatedTableNameFromParameter = readValidatedTableNameFromParameter;
exports.resolveTableNameForColumnSelector = resolveTableNameForColumnSelector;
exports.resolveSchemaForColumnSelector = resolveSchemaForColumnSelector;
exports.resolveContextForColumnSelector = resolveContextForColumnSelector;
const pickerUtils_1 = require("./pickerUtils");
const loadOptionsPostgres_1 = require("./loadOptionsPostgres");
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
function findParentNodeByType(context, baseTypes) {
    let parents;
    try {
        parents = context.getParentNodes(context.getNode().name, {
            includeNodeParameters: true,
            depth: 12,
        });
    }
    catch {
        return undefined;
    }
    return parents.find((parent) => {
        var _a;
        const type = String((_a = parent.type) !== null && _a !== void 0 ? _a : '');
        return baseTypes.some((base) => type === base || type.endsWith(`.${base}`));
    });
}
function findParentTableSelectorNode(context) {
    return findParentNodeByType(context, ['collapsTableSelector', 'collapsTablePicker']);
}
function readSchemaFromUpstreamInput(input) {
    return readSchemaFromUpstreamInputStrict(input);
}
/** Design-time resolution: an absent upstream schema must stay empty so no query is attempted. */
function readSchemaFromUpstreamInputStrict(input) {
    var _a, _b;
    const schema = String((_b = (_a = input.selectedSchema) !== null && _a !== void 0 ? _a : input.schema) !== null && _b !== void 0 ? _b : '').trim();
    return (0, sqlValidation_1.isValidSqlIdentifier)(schema) ? schema : '';
}
/**
 * Resolves the schema the Table Selector must list tables for.
 *
 * Order matters: the hidden expression parameter is the only source that survives the
 * design-time sandbox, the live input JSON covers pinned/executed data, and the parent
 * Schema Fetcher parameter is the last resort when nothing has run yet.
 */
async function resolveSchemaForTableSelector(context) {
    var _a, _b;
    const fromHiddenParameter = readHiddenNodeParameter(context, 'upstreamSchema');
    if ((0, sqlValidation_1.isValidSqlIdentifier)(fromHiddenParameter)) {
        return fromHiddenParameter;
    }
    const upstream = await tryGetUpstreamJson(context);
    const fromConnection = readSchemaFromUpstreamInputStrict(upstream);
    if (fromConnection) {
        return fromConnection;
    }
    const parentSchemaFetcher = findParentNodeByType(context, ['collapsSchemaFetcher']);
    const fromParentParameter = String((_b = (_a = parentSchemaFetcher === null || parentSchemaFetcher === void 0 ? void 0 : parentSchemaFetcher.parameters) === null || _a === void 0 ? void 0 : _a.selectedSchema) !== null && _b !== void 0 ? _b : '').trim();
    return (0, sqlValidation_1.isValidSqlIdentifier)(fromParentParameter) ? fromParentParameter : '';
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
    var _a, _b;
    const fromHiddenParameter = readHiddenNodeParameter(context, 'upstreamSchema');
    if ((0, sqlValidation_1.isValidSqlIdentifier)(fromHiddenParameter)) {
        return fromHiddenParameter;
    }
    const upstream = await tryGetUpstreamJson(context);
    const fromConnection = readSchemaFromUpstreamInputStrict(upstream);
    if (fromConnection) {
        return fromConnection;
    }
    const parentTableSelector = findParentTableSelectorNode(context);
    const fromParentParameter = String((_b = (_a = parentTableSelector === null || parentTableSelector === void 0 ? void 0 : parentTableSelector.parameters) === null || _a === void 0 ? void 0 : _a.upstreamSchema) !== null && _b !== void 0 ? _b : '').trim();
    return (0, sqlValidation_1.isValidSqlIdentifier)(fromParentParameter) ? fromParentParameter : '';
}
async function resolveContextForColumnSelector(context) {
    const [schema, tableName] = await Promise.all([
        resolveSchemaForColumnSelector(context),
        resolveTableNameForColumnSelector(context),
    ]);
    return { schema, tableName };
}
