"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollapsRefinerTrigger = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const collapsLogger_1 = require("../helpers/collapsLogger");
const loadOptionsConnection_1 = require("../helpers/loadOptionsConnection");
const postgresClient_1 = require("../helpers/postgresClient");
const sqlValidation_1 = require("../helpers/sqlValidation");
const NODE_NAME = 'CollapsRefinerTrigger';
const CONFIG_TABLE = 'a_2_config_ingesta_a';
const CATALYST_URL = 'https://bttf-engine-31997537275.us-central1.run.app/api/v1/catalyst/job';
const PRODUCTION_N8N_BASE_URL = 'https://n8n-collaps-31997537275.us-central1.run.app';
function resolveCallbackUrl(context) {
    const executionId = context.getExecutionId();
    return `${PRODUCTION_N8N_BASE_URL}/webhook-waiting/${encodeURIComponent(executionId)}`;
}
function readResolvedParameter(context, name, itemIndex) {
    var _a;
    const value = String((_a = context.getNodeParameter(name, itemIndex, '')) !== null && _a !== void 0 ? _a : '').trim();
    return value.startsWith('=') || value.includes('{{') ? '' : value;
}
function resolveExecuteConnection(context, itemIndex, input) {
    var _a;
    const fromInput = (_a = (0, loadOptionsConnection_1.connectionFromInput)(input)) !== null && _a !== void 0 ? _a : (0, postgresClient_1.resolveConnectionConfig)(input);
    if (fromInput) {
        return fromInput;
    }
    return (0, postgresClient_1.resolveConnectionConfig)({}, {
        host: readResolvedParameter(context, 'connectionHost', itemIndex),
        port: Number(context.getNodeParameter('connectionPort', itemIndex, 0)),
        database: readResolvedParameter(context, 'connectionDatabase', itemIndex),
        user: readResolvedParameter(context, 'connectionUser', itemIndex),
        password: readResolvedParameter(context, 'connectionPassword', itemIndex),
    });
}
class CollapsRefinerTrigger {
    constructor() {
        this.description = {
            displayName: 'COLLAPS Refiner Trigger',
            name: 'collapsRefinerTrigger',
            icon: 'fa:flask',
            group: ['transform'],
            version: 1,
            subtitle: 'Catalyst Job',
            description: 'Triggers the async COLLAPS Catalyst (refiner) job on Cloud Run and injects callbackUrl for n8n Wait resume.',
            defaults: {
                name: 'COLLAPS Refiner Trigger',
            },
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            properties: [
                ...(0, loadOptionsConnection_1.upstreamConnectionProperties)(),
                {
                    displayName: 'Internal Schema Name',
                    name: 'schemaName',
                    type: 'hidden',
                    default: '={{ $json.schema || "" }}',
                },
                {
                    displayName: 'Internal Source Table',
                    name: 'sourceTable',
                    type: 'hidden',
                    default: '={{ $json.tableName || "" }}',
                },
                {
                    displayName: 'Internal Callback URL',
                    name: 'callbackUrl',
                    type: 'hidden',
                    default: '',
                },
            ],
        };
    }
    async execute() {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const items = this.getInputData();
        const returnData = [];
        for (let itemIndex = 0; itemIndex < Math.max(items.length, 1); itemIndex++) {
            try {
                const input = (_d = (_b = (_a = items[itemIndex]) === null || _a === void 0 ? void 0 : _a.json) !== null && _b !== void 0 ? _b : (_c = items[0]) === null || _c === void 0 ? void 0 : _c.json) !== null && _d !== void 0 ? _d : {};
                const schemaName = String(this.getNodeParameter('schemaName', itemIndex, '')).trim() ||
                    String((_f = (_e = input.schema) !== null && _e !== void 0 ? _e : input.schemaName) !== null && _f !== void 0 ? _f : '').trim();
                const sourceTable = String(this.getNodeParameter('sourceTable', itemIndex, '')).trim() ||
                    String((_h = (_g = input.tableName) !== null && _g !== void 0 ? _g : input.sourceTable) !== null && _h !== void 0 ? _h : '').trim();
                if (!schemaName || !(0, sqlValidation_1.isValidSqlIdentifier)(schemaName)) {
                    throw new Error('A valid Schema Name is required.');
                }
                if (!sourceTable || !(0, sqlValidation_1.isValidSqlIdentifier)(sourceTable)) {
                    throw new Error('A valid Source Table is required.');
                }
                const connection = resolveExecuteConnection(this, itemIndex, input);
                if (!connection) {
                    throw new Error('No se recibieron credenciales válidas desde COLLAPS Database Connection.');
                }
                const configuredColumns = await (0, postgresClient_1.withPostgresConnection)(connection, async (client) => {
                    var _a, _b;
                    const configTable = `${(0, postgresClient_1.quoteIdentifier)(schemaName)}.${(0, postgresClient_1.quoteIdentifier)(CONFIG_TABLE)}`;
                    const result = await client.query(`SELECT count(*) AS configured_count
							 FROM ${configTable}
							 WHERE tabla = $1
							   AND guardar = TRUE`, [sourceTable]);
                    return Number((_b = (_a = result.rows[0]) === null || _a === void 0 ? void 0 : _a.configured_count) !== null && _b !== void 0 ? _b : 0);
                });
                if (configuredColumns === 0) {
                    throw new Error(`La tabla ${sourceTable} no ha sido configurada en NocoDB.`);
                }
                const callbackUrl = resolveCallbackUrl(this);
                const payloadToSend = {
                    source: 'n8n',
                    schemaName,
                    sourceTable,
                    callbackUrl,
                };
                (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'execute()', { phase: 'catalyst_request', payloadToSend }, 'POST /api/v1/catalyst/job — async refiner job.');
                const apiResponse = (await this.helpers.request({
                    method: 'POST',
                    uri: CATALYST_URL,
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: payloadToSend,
                    json: true,
                }));
                const emittedPayload = {
                    request: payloadToSend,
                    response: apiResponse,
                };
                (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'execute()', emittedPayload, 'Catalyst job accepted (HTTP 202 expected). Use Wait node for callback resume.');
                returnData.push(...this.helpers.returnJsonArray({
                    request: payloadToSend,
                    response: apiResponse,
                }));
            }
            catch (error) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex });
            }
        }
        return [returnData];
    }
}
exports.CollapsRefinerTrigger = CollapsRefinerTrigger;
