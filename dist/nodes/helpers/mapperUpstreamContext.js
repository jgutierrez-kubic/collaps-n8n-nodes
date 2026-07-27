"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryGetUpstreamJsonAtInput = tryGetUpstreamJsonAtInput;
exports.resolveMapperUpstreamContext = resolveMapperUpstreamContext;
const pickerUtils_1 = require("./pickerUtils");
const postgresClient_1 = require("./postgresClient");
const upstreamContext_1 = require("./upstreamContext");
const transformerPairing_1 = require("./transformerPairing");
const sqlValidation_1 = require("./sqlValidation");
const COLUMN_SELECTOR_SUFFIX = '.collapsColumnSelector';
const TABLE_SELECTOR_SUFFIX = '.collapsTableSelector';
const SCHEMA_FETCHER_SUFFIX = '.collapsSchemaFetcher';
function isColumnSelectorType(type) {
    return type === 'collapsColumnSelector' || type.endsWith(COLUMN_SELECTOR_SUFFIX);
}
function isTableSelectorType(type) {
    return type === 'collapsTableSelector' || type.endsWith(TABLE_SELECTOR_SUFFIX);
}
function isSchemaFetcherType(type) {
    return type === 'collapsSchemaFetcher' || type.endsWith(SCHEMA_FETCHER_SUFFIX);
}
function normalizeColumns(columns) {
    return (0, pickerUtils_1.parseColumnsInput)(columns).filter((column) => (0, sqlValidation_1.isValidSqlIdentifier)(column));
}
function readBranchFromJson(json) {
    const tableName = (0, upstreamContext_1.readValidatedTableNameFromInput)(json);
    if (!tableName) {
        return undefined;
    }
    return {
        schema: (0, upstreamContext_1.readSchemaFromUpstreamInput)(json),
        tableName,
        columns: (0, transformerPairing_1.toColumnsArray)(json.columns).filter((column) => (0, sqlValidation_1.isValidSqlIdentifier)(column)),
    };
}
function readSchemaFromSelectorAncestors(context, selectorNodeName) {
    var _a, _b, _c, _d;
    const ancestors = context.getParentNodes(selectorNodeName, {
        includeNodeParameters: true,
        depth: 3,
    });
    for (const ancestor of ancestors) {
        if (isSchemaFetcherType(ancestor.type)) {
            const selectedSchema = String((_b = (_a = ancestor.parameters) === null || _a === void 0 ? void 0 : _a.selectedSchema) !== null && _b !== void 0 ? _b : '').trim();
            if ((0, sqlValidation_1.isValidSqlIdentifier)(selectedSchema)) {
                return selectedSchema;
            }
        }
    }
    for (const ancestor of ancestors) {
        if (isTableSelectorType(ancestor.type)) {
            const parents = context.getParentNodes(ancestor.name, {
                includeNodeParameters: true,
                depth: 1,
            });
            for (const parent of parents) {
                if (isSchemaFetcherType(parent.type)) {
                    const selectedSchema = String((_d = (_c = parent.parameters) === null || _c === void 0 ? void 0 : _c.selectedSchema) !== null && _d !== void 0 ? _d : '').trim();
                    if ((0, sqlValidation_1.isValidSqlIdentifier)(selectedSchema)) {
                        return selectedSchema;
                    }
                }
            }
        }
    }
    return postgresClient_1.DEFAULT_SELECTOR_SCHEMA;
}
function readTableNameFromSelectorAncestors(context, selectorNodeName) {
    var _a;
    const ancestors = context.getParentNodes(selectorNodeName, {
        includeNodeParameters: true,
        depth: 2,
    });
    for (const ancestor of ancestors) {
        if (isTableSelectorType(ancestor.type)) {
            const tableName = (0, upstreamContext_1.readValidatedTableNameFromParameter)((_a = ancestor.parameters) === null || _a === void 0 ? void 0 : _a.tableName);
            if (tableName) {
                return tableName;
            }
        }
    }
    return '';
}
function readBranchFromColumnSelectorNode(context, selector) {
    var _a, _b;
    const columns = normalizeColumns((_a = selector.parameters) === null || _a === void 0 ? void 0 : _a.columns);
    const tableName = (0, upstreamContext_1.readValidatedTableNameFromParameter)((_b = selector.parameters) === null || _b === void 0 ? void 0 : _b.upstreamTableName) ||
        readTableNameFromSelectorAncestors(context, selector.name);
    if (!tableName) {
        return undefined;
    }
    return {
        schema: readSchemaFromSelectorAncestors(context, selector.name),
        tableName,
        columns,
    };
}
function mergeBranchContexts(primary, fallback) {
    if (!primary && !fallback) {
        return undefined;
    }
    const tableName = (primary === null || primary === void 0 ? void 0 : primary.tableName) || (fallback === null || fallback === void 0 ? void 0 : fallback.tableName) || '';
    if (!tableName) {
        return undefined;
    }
    const schema = (primary === null || primary === void 0 ? void 0 : primary.schema) || (fallback === null || fallback === void 0 ? void 0 : fallback.schema) || postgresClient_1.DEFAULT_SELECTOR_SCHEMA;
    const columns = (primary === null || primary === void 0 ? void 0 : primary.columns) && primary.columns.length > 0
        ? primary.columns
        : (fallback === null || fallback === void 0 ? void 0 : fallback.columns) && fallback.columns.length > 0
            ? fallback.columns
            : [];
    return {
        schema,
        tableName,
        columns,
    };
}
async function tryGetUpstreamJsonAtInput(context, inputIndex) {
    var _a, _b, _c, _d, _e, _f;
    const contextWithInput = context;
    if (typeof contextWithInput.getInputData === 'function') {
        try {
            const items = contextWithInput.getInputData(inputIndex);
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
            const byExecuteSignature = await contextWithInput.getInputConnectionData('main', 0, inputIndex);
            if (Array.isArray(byExecuteSignature) && byExecuteSignature.length > 0) {
                return (_d = (_c = byExecuteSignature[0]) === null || _c === void 0 ? void 0 : _c.json) !== null && _d !== void 0 ? _d : {};
            }
        }
        catch {
            // Try alternate loadOptions signature below.
        }
        try {
            const byLoadOptionsSignature = await contextWithInput.getInputConnectionData('main', inputIndex);
            if (Array.isArray(byLoadOptionsSignature) && byLoadOptionsSignature.length > 0) {
                return (_f = (_e = byLoadOptionsSignature[0]) === null || _e === void 0 ? void 0 : _e.json) !== null && _f !== void 0 ? _f : {};
            }
        }
        catch {
            return {};
        }
    }
    return {};
}
function findDirectParentColumnSelectors(context) {
    const parents = context.getParentNodes(context.getNode().name, {
        includeNodeParameters: true,
        depth: 1,
    });
    return parents.filter((parent) => isColumnSelectorType(parent.type));
}
function findAllParentColumnSelectors(context) {
    const parents = context.getParentNodes(context.getNode().name, {
        includeNodeParameters: true,
        depth: 12,
    });
    return parents.filter((parent) => isColumnSelectorType(parent.type));
}
async function resolveBranchFromInputIndexes(context, primaryInputIndex, fallbackInputIndex, orderedSelectors) {
    const [primaryJson, fallbackJson] = await Promise.all([
        tryGetUpstreamJsonAtInput(context, primaryInputIndex),
        tryGetUpstreamJsonAtInput(context, fallbackInputIndex),
    ]);
    const fromConnection = mergeBranchContexts(readBranchFromJson(primaryJson), readBranchFromJson(fallbackJson));
    const primarySelector = orderedSelectors[primaryInputIndex];
    const fallbackSelector = orderedSelectors[fallbackInputIndex];
    const fromParents = mergeBranchContexts(primarySelector ? readBranchFromColumnSelectorNode(context, primarySelector) : undefined, fallbackSelector ? readBranchFromColumnSelectorNode(context, fallbackSelector) : undefined);
    return mergeBranchContexts(fromParents, fromConnection);
}
function resolveBranchesFromSelectorGroups(selectors, context) {
    var _a, _b, _c;
    const branches = selectors
        .map((selector) => readBranchFromColumnSelectorNode(context, selector))
        .filter((branch) => Boolean(branch === null || branch === void 0 ? void 0 : branch.tableName));
    const byTable = new Map();
    for (const branch of branches) {
        const group = (_a = byTable.get(branch.tableName)) !== null && _a !== void 0 ? _a : [];
        group.push(branch);
        byTable.set(branch.tableName, group);
    }
    const tableNames = Array.from(byTable.keys()).sort();
    if (tableNames.length < 2) {
        return {};
    }
    const pickColumnsBranch = (group) => group.reduce((best, current) => (current.columns.length > best.columns.length ? current : best));
    return {
        sideA: pickColumnsBranch((_b = byTable.get(tableNames[0])) !== null && _b !== void 0 ? _b : []),
        sideB: pickColumnsBranch((_c = byTable.get(tableNames[1])) !== null && _c !== void 0 ? _c : []),
    };
}
async function resolveMapperUpstreamContext(context) {
    var _a, _b, _c, _d, _e, _f;
    const orderedSelectors = findDirectParentColumnSelectors(context);
    const allSelectors = orderedSelectors.length > 0 ? orderedSelectors : findAllParentColumnSelectors(context);
    const [sideA, sideB] = await Promise.all([
        resolveBranchFromInputIndexes(context, 1, 0, orderedSelectors),
        resolveBranchFromInputIndexes(context, 3, 2, orderedSelectors),
    ]);
    if (((_a = sideA === null || sideA === void 0 ? void 0 : sideA.columns) === null || _a === void 0 ? void 0 : _a.length) && ((_b = sideB === null || sideB === void 0 ? void 0 : sideB.columns) === null || _b === void 0 ? void 0 : _b.length)) {
        return { sideA, sideB };
    }
    const grouped = resolveBranchesFromSelectorGroups(allSelectors, context);
    return {
        sideA: ((_c = sideA === null || sideA === void 0 ? void 0 : sideA.columns) === null || _c === void 0 ? void 0 : _c.length) ? sideA : (_d = grouped.sideA) !== null && _d !== void 0 ? _d : sideA,
        sideB: ((_e = sideB === null || sideB === void 0 ? void 0 : sideB.columns) === null || _e === void 0 ? void 0 : _e.length) ? sideB : (_f = grouped.sideB) !== null && _f !== void 0 ? _f : sideB,
    };
}
