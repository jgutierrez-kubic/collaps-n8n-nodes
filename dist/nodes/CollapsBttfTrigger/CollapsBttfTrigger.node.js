"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollapsBttfTrigger = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const collapsLogger_1 = require("../helpers/collapsLogger");
const tableNameFormatter_1 = require("../helpers/tableNameFormatter");
const NODE_NAME = 'CollapsBttfTrigger';
const ENGINE_URL = 'https://bttf-engine-31997537275.us-central1.run.app/api/v1/condenser/job';
function readRequiredBttfPayload(structureItem) {
    const nested = structureItem === null || structureItem === void 0 ? void 0 : structureItem.bttfPayload;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        return { ...nested };
    }
    throw new Error('No bttfPayload found on Input 0 (Structure & Data). Connect COLLAPS Key & Column Mapper.');
}
function readRequiredMetodosCalculo(methodsItem) {
    const value = methodsItem === null || methodsItem === void 0 ? void 0 : methodsItem.metodos_calculo;
    if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
    }
    const nested = methodsItem === null || methodsItem === void 0 ? void 0 : methodsItem.bttfPayload;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        const fromNested = nested.metodos_calculo;
        if (fromNested !== undefined && fromNested !== null && String(fromNested).trim()) {
            return String(fromNested).trim();
        }
    }
    throw new Error('No metodos_calculo found on Input 1 (Calculation Methods). Connect COLLAPS Method Configurator.');
}
function readPayloadString(payload, camelCaseKey, legacyKey) {
    var _a, _b;
    return String((_b = (_a = payload[camelCaseKey]) !== null && _a !== void 0 ? _a : payload[legacyKey]) !== null && _b !== void 0 ? _b : '').trim();
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
class CollapsBttfTrigger {
    constructor() {
        this.description = {
            displayName: 'COLLAPS BTTF Trigger',
            name: 'collapsBttfTrigger',
            icon: 'fa:bolt',
            group: ['transform'],
            version: 1,
            subtitle: 'BTTF Condenser Job',
            description: 'Merges structure (Input 0) with methods (Input 1) and POSTs the job to the COLLAPS BTTF Engine on Cloud Run. Persistence is handled by the engine.',
            defaults: {
                name: 'COLLAPS BTTF Trigger',
            },
            inputs: [
                { displayName: 'Structure & Data', type: n8n_workflow_1.NodeConnectionTypes.Main },
                { displayName: 'Calculation Methods', type: n8n_workflow_1.NodeConnectionTypes.Main },
            ],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            properties: [
                {
                    displayName: 'Analysis Name',
                    name: 'analysisName',
                    type: 'string',
                    default: 'My Analysis',
                    required: true,
                    description: 'Human-readable analysis name. The targetTable API field is generated automatically as c_results_<camelCaseName>.',
                },
            ],
        };
    }
    async execute() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const structureItems = this.getInputData(0);
        const methodsItems = this.getInputData(1);
        const returnData = [];
        if (structureItems.length === 0) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), new Error('Input 0 (Structure & Data) is empty. Connect COLLAPS Key & Column Mapper.'));
        }
        if (methodsItems.length === 0) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), new Error('Input 1 (Calculation Methods) is empty. Connect COLLAPS Method Configurator.'));
        }
        const itemCount = Math.max(structureItems.length, methodsItems.length);
        for (let itemIndex = 0; itemIndex < itemCount; itemIndex++) {
            try {
                const structureInput = (_d = (_b = (_a = structureItems[itemIndex]) === null || _a === void 0 ? void 0 : _a.json) !== null && _b !== void 0 ? _b : (_c = structureItems[0]) === null || _c === void 0 ? void 0 : _c.json) !== null && _d !== void 0 ? _d : {};
                const methodsInput = (_h = (_f = (_e = methodsItems[itemIndex]) === null || _e === void 0 ? void 0 : _e.json) !== null && _f !== void 0 ? _f : (_g = methodsItems[0]) === null || _g === void 0 ? void 0 : _g.json) !== null && _h !== void 0 ? _h : {};
                const basePayload = readRequiredBttfPayload(structureInput);
                const metodosCalculo = readRequiredMetodosCalculo(methodsInput);
                const analysisName = String((_j = this.getNodeParameter('analysisName', itemIndex, 'My Analysis')) !== null && _j !== void 0 ? _j : 'My Analysis').trim();
                if (!analysisName) {
                    throw new Error('Analysis Name (analysisName) is required.');
                }
                const callbackUrl = resolveCallbackUrl(this);
                const payloadToSend = {
                    source: readPayloadString(basePayload, 'source', 'source'),
                    analysisId: readPayloadString(basePayload, 'analysisId', 'analysis_id'),
                    schemaName: readPayloadString(basePayload, 'schemaName', 'schema_name'),
                    analysisName,
                    tableA: readPayloadString(basePayload, 'tableA', 'tabla_a'),
                    tableB: readPayloadString(basePayload, 'tableB', 'tabla_b'),
                    joinKeyA: readPayloadString(basePayload, 'joinKeyA', 'llave_cruce_a'),
                    joinKeyB: readPayloadString(basePayload, 'joinKeyB', 'llave_cruce_b'),
                    columnsA: readPayloadString(basePayload, 'columnsA', 'columnas_a'),
                    columnsB: readPayloadString(basePayload, 'columnsB', 'columnas_b'),
                    calculationMethods: metodosCalculo,
                    targetTable: (0, tableNameFormatter_1.buildTargetTableName)(analysisName),
                    callbackUrl,
                };
                (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'execute()', { phase: 'merged_payload', payloadToSend }, 'Payload camelCase consolidado para el contrato Condenser.');
                const apiResponse = (await this.helpers.request({
                    method: 'POST',
                    uri: ENGINE_URL,
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
                (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'execute()', emittedPayload, 'Job aceptado por BTTF Engine (HTTP 202 esperado).');
                returnData.push(...this.helpers.returnJsonArray({
                    request: payloadToSend,
                    response: apiResponse,
                }));
            }
            catch (error) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error);
            }
        }
        return [returnData];
    }
}
exports.CollapsBttfTrigger = CollapsBttfTrigger;
