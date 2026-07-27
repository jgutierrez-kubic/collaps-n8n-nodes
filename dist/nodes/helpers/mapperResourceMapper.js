"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildColumnMapResourceMapperFields = buildColumnMapResourceMapperFields;
exports.resolveMapperResourceMapperFields = resolveMapperResourceMapperFields;
const collapsLogger_1 = require("./collapsLogger");
const sqlValidation_1 = require("./sqlValidation");
const NODE_NAME = 'CollapsKeyColumnMapper';
function readHiddenCsvParameter(context, parameterName) {
    try {
        const raw = context.getCurrentNodeParameter(parameterName);
        const value = String(raw !== null && raw !== void 0 ? raw : '').trim();
        if (!value || value.startsWith('={{')) {
            return '';
        }
        return value;
    }
    catch {
        return '';
    }
}
function parseColumnsCsv(csv) {
    if (!csv) {
        return [];
    }
    return csv
        .split(',')
        .map((column) => column.trim())
        .filter((column) => (0, sqlValidation_1.isValidSqlIdentifier)(column));
}
function buildColumnMapResourceMapperFields(columnsA, columnsB) {
    if (columnsA.length === 0 || columnsB.length === 0) {
        return [];
    }
    const targetOptions = columnsB.map((column) => ({
        name: column,
        value: column,
    }));
    return columnsA.map((columnA) => ({
        id: columnA,
        displayName: columnA,
        required: false,
        defaultMatch: false,
        display: true,
        canBeUsedToMatch: true,
        type: 'options',
        options: targetOptions,
    }));
}
function resolveMapperResourceMapperFields(context) {
    var _a;
    (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'getMappingColumns()', { status: 'ENTRY', node: context.getNode().name }, 'Hook resourceMapper iniciado (expression bypass).');
    const colsAStr = readHiddenCsvParameter(context, 'upstreamColumnsA_csv');
    const colsBStr = readHiddenCsvParameter(context, 'upstreamColumnsB_csv');
    const columnsA = parseColumnsCsv(colsAStr);
    const columnsB = parseColumnsCsv(colsBStr);
    const fields = buildColumnMapResourceMapperFields(columnsA, columnsB);
    const debug = {
        upstreamColumnsA_csv: colsAStr,
        upstreamColumnsB_csv: colsBStr,
        columnsA,
        columnsB,
        columnsACount: columnsA.length,
        columnsBCount: columnsB.length,
        fieldsCount: fields.length,
        fieldIds: fields.map((field) => field.id),
    };
    (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'getMappingColumns()', debug, 'Columnas resueltas desde parámetros ocultos antes de retornar fields.');
    const result = { fields };
    (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'getMappingColumns()', {
        returnShape: 'ResourceMapperFields',
        fieldsCount: result.fields.length,
        firstField: (_a = result.fields[0]) !== null && _a !== void 0 ? _a : null,
    }, 'Retorno final del resourceMapper.');
    return { result, debug };
}
