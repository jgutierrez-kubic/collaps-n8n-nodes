"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollapsBttfTrigger = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const collapsLogger_1 = require("../helpers/collapsLogger");
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
function resolveTablaDestino(schemaName, targetTable) {
    const table = targetTable.trim();
    if (!table) {
        return '';
    }
    if (table.includes('.')) {
        return table;
    }
    const schema = String(schemaName !== null && schemaName !== void 0 ? schemaName : '').trim();
    return schema ? `${schema}.${table}` : table;
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
                    description: 'Human-readable analysis name sent as nombre_analisis.',
                },
                {
                    displayName: 'Target Table',
                    name: 'targetTable',
                    type: 'string',
                    default: 'c_resultados',
                    required: true,
                    description: 'Destination table for engine results (tabla_destino). Schema is prepended from the Mapper payload when omitted.',
                },
            ],
        };
    }
    async execute() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
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
                const targetTable = String((_k = this.getNodeParameter('targetTable', itemIndex, 'c_resultados')) !== null && _k !== void 0 ? _k : 'c_resultados').trim();
                if (!analysisName) {
                    throw new Error('Analysis Name (analysisName) is required.');
                }
                if (!targetTable) {
                    throw new Error('Target Table (targetTable) is required.');
                }
                let resolvedCallbackUrl = '';
                try {
                    resolvedCallbackUrl = this.evaluateExpression('{{ $execution.resumeUrl }}', 0);
                    resolvedCallbackUrl = String(resolvedCallbackUrl !== null && resolvedCallbackUrl !== void 0 ? resolvedCallbackUrl : '')
                        .replace(/^=/, '')
                        .trim();
                }
                catch {
                    // If evaluation fails or Wait/resume is not available, leave empty.
                }
                resolvedCallbackUrl = String(resolvedCallbackUrl !== null && resolvedCallbackUrl !== void 0 ? resolvedCallbackUrl : '').trim();
                const payloadToSend = {
                    ...basePayload,
                    metodos_calculo: metodosCalculo,
                    nombre_analisis: analysisName,
                    tabla_destino: resolveTablaDestino(basePayload.schema_name, targetTable),
                };
                if (resolvedCallbackUrl) {
                    payloadToSend.callback_url = resolvedCallbackUrl;
                }
                (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'execute()', { phase: 'merged_payload', payloadToSend }, 'Payload consolidado Input0+Input1 + UI (analysisName/targetTable).');
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
