"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollapsWorkTableGenerator = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const collapsLogger_1 = require("../helpers/collapsLogger");
const sqlValidation_1 = require("../helpers/sqlValidation");
const tableNameFormatter_1 = require("../helpers/tableNameFormatter");
const NODE_NAME = 'CollapsWorkTableGenerator';
const WORKTABLES_URL = 'https://bttf-engine-31997537275.us-central1.run.app/api/v1/worktables/create';
function readStructurePayload(input) {
    const nested = input.bttfPayload;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        return nested;
    }
    const request = input.request;
    if (request && typeof request === 'object' && !Array.isArray(request)) {
        return request;
    }
    return input;
}
function readPayloadString(payload, camelCaseKey, legacyKey) {
    var _a, _b;
    return String((_b = (_a = payload[camelCaseKey]) !== null && _a !== void 0 ? _a : payload[legacyKey]) !== null && _b !== void 0 ? _b : '').trim();
}
function parseColumnList(value) {
    const values = Array.isArray(value) ? value : String(value !== null && value !== void 0 ? value : '').split(',');
    return values
        .map((column) => String(column).trim())
        .filter(Boolean)
        .map((column) => {
        if (!(0, sqlValidation_1.isValidSqlIdentifier)(column)) {
            throw new Error(`Invalid Group By column: "${column}"`);
        }
        return column;
    });
}
function resolveCallbackUrl(context) {
    try {
        const value = context.evaluateExpression('{{ $execution.resumeUrl }}', 0);
        return String(value !== null && value !== void 0 ? value : '').replace(/^=/, '').trim();
    }
    catch {
        return '';
    }
}
class CollapsWorkTableGenerator {
    constructor() {
        this.description = {
            displayName: 'COLLAPS Work Table Generator',
            name: 'collapsWorkTableGenerator',
            icon: 'fa:table',
            group: ['transform'],
            version: 1,
            subtitle: 'Create Derived Work Table',
            description: 'Builds a camelCase work-table request and delegates physical table creation to the COLLAPS Python backend.',
            defaults: {
                name: 'COLLAPS Work Table Generator',
            },
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            properties: [
                {
                    displayName: 'Source Table',
                    name: 'sourceSide',
                    type: 'options',
                    default: 'A',
                    required: true,
                    options: [
                        { name: 'Data A', value: 'A' },
                        { name: 'Data B', value: 'B' },
                    ],
                    description: 'Whether sourceTable is resolved from tableA or tableB.',
                },
                {
                    displayName: 'Work Table Name',
                    name: 'workTableName',
                    type: 'string',
                    default: '',
                    required: true,
                    placeholder: 'e.g. Monthly Fruit Summary',
                    description: 'Friendly name converted automatically to targetTable using the w_table_ prefix.',
                },
                {
                    displayName: 'Group By Columns',
                    name: 'groupByColumns',
                    type: 'string',
                    default: '',
                    required: false,
                    placeholder: 'e.g. category,region',
                    description: 'Comma-separated column names.',
                },
                {
                    displayName: 'Order By Rules',
                    name: 'orderByRules',
                    type: 'fixedCollection',
                    default: {},
                    typeOptions: {
                        multipleValues: true,
                        sortable: true,
                    },
                    options: [
                        {
                            displayName: 'Rule',
                            name: 'rules',
                            values: [
                                {
                                    displayName: 'Column',
                                    name: 'column',
                                    type: 'string',
                                    default: '',
                                    required: true,
                                },
                                {
                                    displayName: 'Direction',
                                    name: 'direction',
                                    type: 'options',
                                    default: 'ASC',
                                    options: [
                                        { name: 'Ascending', value: 'ASC' },
                                        { name: 'Descending', value: 'DESC' },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        };
    }
    async execute() {
        var _a, _b, _c;
        const items = this.getInputData();
        const returnData = [];
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const input = (_b = (_a = items[itemIndex]) === null || _a === void 0 ? void 0 : _a.json) !== null && _b !== void 0 ? _b : {};
                const structurePayload = readStructurePayload(input);
                const sourceSide = this.getNodeParameter('sourceSide', itemIndex, 'A');
                const friendlyName = String(this.getNodeParameter('workTableName', itemIndex, '')).trim();
                const groupByColumns = parseColumnList(this.getNodeParameter('groupByColumns', itemIndex, '')).join(', ');
                const orderByParameter = this.getNodeParameter('orderByRules', itemIndex, {});
                if (!friendlyName) {
                    throw new Error('Work Table Name is required.');
                }
                const schemaName = readPayloadString(structurePayload, 'schemaName', 'schema_name');
                const sourceTable = sourceSide === 'A'
                    ? readPayloadString(structurePayload, 'tableA', 'tabla_a')
                    : readPayloadString(structurePayload, 'tableB', 'tabla_b');
                if (!schemaName) {
                    throw new Error('No schemaName found in the input payload.');
                }
                if (!sourceTable) {
                    throw new Error(`No source table found for side ${sourceSide}.`);
                }
                const orderByRules = ((_c = orderByParameter.rules) !== null && _c !== void 0 ? _c : [])
                    .map((rule) => {
                    var _a;
                    const column = String((_a = rule.column) !== null && _a !== void 0 ? _a : '').trim();
                    if (!(0, sqlValidation_1.isValidSqlIdentifier)(column)) {
                        throw new Error(`Invalid Order By column: "${column}"`);
                    }
                    const direction = rule.direction === 'DESC' ? 'DESC' : 'ASC';
                    return `${column} ${direction}`;
                })
                    .join(', ');
                const payloadToSend = {
                    schemaName,
                    sourceTable,
                    targetTable: (0, tableNameFormatter_1.buildWorkTableName)(friendlyName),
                    groupByColumns,
                    orderByRules,
                    callbackUrl: resolveCallbackUrl(this),
                };
                const apiResponse = (await this.helpers.request({
                    method: 'POST',
                    uri: WORKTABLES_URL,
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: payloadToSend,
                    json: true,
                }));
                const output = {
                    request: payloadToSend,
                    response: apiResponse,
                };
                (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'execute()', output, 'Work-table request sent using the strict camelCase API contract.');
                returnData.push({
                    json: output,
                    pairedItem: { item: itemIndex },
                });
            }
            catch (error) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, {
                    itemIndex,
                });
            }
        }
        return [returnData];
    }
}
exports.CollapsWorkTableGenerator = CollapsWorkTableGenerator;
