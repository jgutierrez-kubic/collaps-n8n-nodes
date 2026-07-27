"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollapsMethodConfigurator = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const bttfMethods_1 = require("../helpers/bttfMethods");
const collapsLogger_1 = require("../helpers/collapsLogger");
const mapperPairLabels_1 = require("../helpers/mapperPairLabels");
const transformerPairing_1 = require("../helpers/transformerPairing");
const NODE_NAME = 'CollapsMethodConfigurator';
function extractMapperInput(input) {
    if (!input.bttfPayload || typeof input.bttfPayload !== 'object' || Array.isArray(input.bttfPayload)) {
        throw new Error('No bttfPayload found in input. Connect the output of COLLAPS Key & Column Mapper.');
    }
    const columnPairs = (0, transformerPairing_1.parseColumnPairsFromInput)(input);
    if (columnPairs.length === 0) {
        throw new Error('No column pairs detected from Key & Column Mapper input.');
    }
    return {
        bttfPayload: input.bttfPayload,
        columnPairs,
    };
}
function resolveMethodsForPairs(assignmentMode, columnPairs, globalMethod, pairAssignments) {
    var _a;
    if (assignmentMode === 'global') {
        return columnPairs.map(() => ({
            method: globalMethod,
            method_source: 'global',
        }));
    }
    const methodByLabel = new Map();
    for (const assignment of pairAssignments) {
        const pairKey = String((_a = assignment.pairKey) !== null && _a !== void 0 ? _a : '').trim();
        if (!pairKey) {
            continue;
        }
        const matchingPair = columnPairs.find((pair) => pair.pair_label === pairKey);
        if (matchingPair) {
            methodByLabel.set(matchingPair.pair_label, assignment.method);
        }
    }
    return columnPairs.map((pair) => {
        const assigned = methodByLabel.get(pair.pair_label);
        if (assigned) {
            return {
                method: assigned,
                method_source: 'user',
            };
        }
        return {
            method: bttfMethods_1.PER_PAIR_FALLBACK_METHOD,
            method_source: 'fallback_strict_equal',
        };
    });
}
function mergePairOptions(baseOptions, selectedKeys) {
    const merged = new Map();
    for (const option of baseOptions) {
        const value = String(option.value).trim();
        if (!value) {
            continue;
        }
        merged.set(value, { name: String(option.name), value });
    }
    for (const key of selectedKeys) {
        if (key && !merged.has(key)) {
            merged.set(key, { name: key, value: key });
        }
    }
    return Array.from(merged.values());
}
function readUpstreamColumnPairsParameter(context) {
    try {
        return context.getCurrentNodeParameter('upstreamColumnPairs');
    }
    catch {
        return '[]';
    }
}
function parseUpstreamColumnPairs(raw) {
    if (Array.isArray(raw)) {
        return raw;
    }
    const pairsStr = String(raw !== null && raw !== void 0 ? raw : '').trim();
    if (!pairsStr || pairsStr.startsWith('={{')) {
        return [];
    }
    try {
        const parsed = JSON.parse(pairsStr);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
class CollapsMethodConfigurator {
    constructor() {
        this.description = {
            displayName: 'COLLAPS Method Configurator',
            name: 'collapsMethodConfigurator',
            icon: 'fa:sliders',
            group: ['transform'],
            version: 1,
            subtitle: 'Method Configurator',
            description: 'Assigns metodos_calculo per pair using human-readable labels from Key & Column Mapper (e.g. NAME / NAME).',
            defaults: {
                name: 'COLLAPS Method Configurator',
            },
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            properties: [
                {
                    displayName: 'Upstream Column Pairs',
                    name: 'upstreamColumnPairs',
                    type: 'hidden',
                    default: '={{ JSON.stringify($json.column_pairs || []) }}',
                },
                {
                    displayName: 'Assignment Mode',
                    name: 'assignmentMode',
                    type: 'options',
                    options: [
                        { name: 'Global', value: 'global' },
                        { name: 'Per Pair', value: 'perPair' },
                    ],
                    default: 'global',
                    required: true,
                },
                {
                    displayName: 'Global Method',
                    name: 'globalMethod',
                    type: 'options',
                    options: bttfMethods_1.BTTF_METHOD_OPTIONS,
                    default: bttfMethods_1.DEFAULT_BTTF_METHOD,
                    required: true,
                    displayOptions: {
                        show: {
                            assignmentMode: ['global'],
                        },
                    },
                },
                {
                    displayName: 'Pair Methods',
                    name: 'pairMethodAssignments',
                    type: 'fixedCollection',
                    typeOptions: {
                        multipleValues: true,
                    },
                    default: {},
                    displayOptions: {
                        show: {
                            assignmentMode: ['perPair'],
                        },
                    },
                    description: 'Select each pair by its human-readable label (e.g. NAME / NAME) and assign a BTTF method.',
                    options: [
                        {
                            displayName: 'Assignment',
                            name: 'pairs',
                            values: [
                                {
                                    displayName: 'Pair',
                                    name: 'pairKey',
                                    type: 'options',
                                    typeOptions: {
                                        loadOptionsMethod: 'getPairOptions',
                                        loadOptionsDependsOn: ['upstreamColumnPairs'],
                                    },
                                    default: '',
                                    description: 'Human-readable pair label (e.g. NAME / NAME).',
                                },
                                {
                                    displayName: 'Method',
                                    name: 'method',
                                    type: 'options',
                                    options: bttfMethods_1.BTTF_METHOD_OPTIONS,
                                    default: bttfMethods_1.DEFAULT_BTTF_METHOD,
                                },
                            ],
                        },
                    ],
                },
            ],
        };
        this.methods = {
            loadOptions: {
                async getPairOptions() {
                    var _a;
                    (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'getPairOptions()', { status: 'ENTRY', node: this.getNode().name }, 'Hook loadOptions iniciado (expression bypass).');
                    try {
                        const pairsRaw = readUpstreamColumnPairsParameter(this);
                        const pairs = parseUpstreamColumnPairs(pairsRaw);
                        const options = [];
                        for (const pair of pairs) {
                            const pairLabel = String((_a = pair === null || pair === void 0 ? void 0 : pair.pair_label) !== null && _a !== void 0 ? _a : '').trim();
                            if (!pairLabel) {
                                continue;
                            }
                            options.push({
                                name: pairLabel,
                                value: pairLabel,
                            });
                        }
                        const merged = mergePairOptions(options, (0, mapperPairLabels_1.readCurrentNodeSelectedPairKeys)(this));
                        (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'getPairOptions()', {
                            rawType: typeof pairsRaw,
                            pairsCount: pairs.length,
                            optionsCount: merged.length,
                            options: merged.map((option) => option.value),
                        }, 'Opciones de Pair resueltas desde upstreamColumnPairs.');
                        return merged;
                    }
                    catch (error) {
                        (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'getPairOptions()', { error: error instanceof Error ? error.message : String(error) }, 'ERROR — retornando [].');
                        return [];
                    }
                },
            },
        };
    }
    async execute() {
        var _a, _b, _c, _d;
        const items = this.getInputData();
        const returnData = [];
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const input = (_b = (_a = items[itemIndex]) === null || _a === void 0 ? void 0 : _a.json) !== null && _b !== void 0 ? _b : {};
                const { bttfPayload, columnPairs } = extractMapperInput(input);
                const assignmentMode = this.getNodeParameter('assignmentMode', itemIndex);
                const globalMethod = this.getNodeParameter('globalMethod', itemIndex, bttfMethods_1.DEFAULT_BTTF_METHOD);
                const pairAssignmentsRaw = this.getNodeParameter('pairMethodAssignments', itemIndex, {});
                const pairAssignments = (_c = pairAssignmentsRaw.pairs) !== null && _c !== void 0 ? _c : [];
                const resolvedMethods = resolveMethodsForPairs(assignmentMode, columnPairs, globalMethod, pairAssignments);
                const metodosCalculo = resolvedMethods.map((entry) => entry.method).join(',');
                const methodPairs = columnPairs.map((pair, index) => ({
                    index: pair.index,
                    pair_label: pair.pair_label,
                    column_a: pair.column_a,
                    column_b: pair.column_b,
                    method: resolvedMethods[index].method,
                    method_source: resolvedMethods[index].method_source,
                }));
                const columnasA = String((_d = bttfPayload.columnas_a) !== null && _d !== void 0 ? _d : '');
                const columnasAArray = columnasA.split(',').map((token) => token.trim()).filter(Boolean);
                const metodosArray = metodosCalculo.split(',').map((token) => token.trim()).filter(Boolean);
                if (columnasAArray.length !== metodosArray.length) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Desajuste de contrato: Hay ${columnasAArray.length} columnas pero se generaron ${metodosArray.length} métodos.`);
                }
                const enrichedPayload = {
                    ...bttfPayload,
                    metodos_calculo: metodosCalculo,
                };
                const emittedPayload = {
                    bttfPayload: enrichedPayload,
                    metodos_calculo: metodosCalculo,
                    method_pairs: methodPairs,
                    column_pairs: columnPairs,
                    assignment_mode: assignmentMode,
                    pairing_warning: input.pairing_warning,
                    key_pair_label: input.key_pair_label,
                    pairing_mode: input.pairing_mode,
                };
                (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'execute()', emittedPayload);
                returnData.push({
                    json: emittedPayload,
                    pairedItem: { item: itemIndex },
                });
            }
            catch (error) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error);
            }
        }
        return [returnData];
    }
}
exports.CollapsMethodConfigurator = CollapsMethodConfigurator;
