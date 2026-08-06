"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollapsKeyColumnMapper = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const mapperResourceMapper_1 = require("../helpers/mapperResourceMapper");
const collapsLogger_1 = require("../helpers/collapsLogger");
const transformerPairing_1 = require("../helpers/transformerPairing");
function readInputBranch(context, inputIndex, label) {
    var _a;
    const items = context.getInputData(inputIndex);
    const json = (_a = items[0]) === null || _a === void 0 ? void 0 : _a.json;
    if (!json) {
        throw new Error(`Input "${label}" (input ${inputIndex}) is empty.`);
    }
    return json;
}
function buildKeyPairLabel(keyA, keyB) {
    return `${keyA} / ${keyB}`;
}
function pairsFromResourceMapper(columnMapping) {
    const value = columnMapping === null || columnMapping === void 0 ? void 0 : columnMapping.value;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return [];
    }
    return Object.entries(value)
        .map(([columnA, columnB], index) => {
        const column_a = String(columnA).trim();
        const column_b = String(columnB !== null && columnB !== void 0 ? columnB : '').trim();
        if (!column_a || !column_b) {
            return null;
        }
        return (0, transformerPairing_1.toPairOutput)(column_a, column_b, index);
    })
        .filter((pair) => pair !== null);
}
class CollapsKeyColumnMapper {
    constructor() {
        this.description = {
            displayName: 'COLLAPS Key & Column Mapper',
            name: 'collapsKeyColumnMapper',
            icon: 'fa:table',
            group: ['transform'],
            version: 1,
            subtitle: 'Key & Column Mapper',
            description: 'Maps keys and column pairs between Source A and Source B',
            defaults: {
                name: 'COLLAPS Key & Column Mapper',
            },
            inputs: [
                { displayName: 'Key A', type: n8n_workflow_1.NodeConnectionTypes.Main },
                { displayName: 'Columns A', type: n8n_workflow_1.NodeConnectionTypes.Main },
                { displayName: 'Key B', type: n8n_workflow_1.NodeConnectionTypes.Main },
                { displayName: 'Columns B', type: n8n_workflow_1.NodeConnectionTypes.Main },
            ],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            properties: [
                {
                    displayName: 'Automated Discovery',
                    name: 'discoveryNotice',
                    type: 'notice',
                    default: '',
                    description: 'Table names and columns are resolved from the connected Key A / Columns A and Key B / Columns B inputs (Column Selector output). Analysis Name and Target Table are configured on COLLAPS BTTF Trigger.',
                },
                {
                    displayName: 'Upstream Columns A CSV',
                    name: 'upstreamColumnsA_csv',
                    type: 'hidden',
                    default: '={{ $input.all(1)[0]?.json?.columns?.join(",") || "" }}',
                },
                {
                    displayName: 'Upstream Columns B CSV',
                    name: 'upstreamColumnsB_csv',
                    type: 'hidden',
                    default: '={{ $input.all(3)[0]?.json?.columns?.join(",") || "" }}',
                },
                {
                    displayName: 'Column Mapping',
                    name: 'columnMapping',
                    type: 'resourceMapper',
                    noDataExpression: true,
                    default: {
                        mappingMode: 'defineBelow',
                        value: null,
                    },
                    typeOptions: {
                        loadOptionsDependsOn: ['upstreamColumnsA_csv', 'upstreamColumnsB_csv'],
                        resourceMapper: {
                            resourceMapperMethod: 'getMappingColumns',
                            mode: 'map',
                            fieldWords: {
                                singular: 'column',
                                plural: 'columns',
                            },
                            addAllFields: true,
                            supportAutoMap: true,
                        },
                    },
                    description: 'Map columns from Table A to Table B. Leave empty to auto-pair by index at execution time.',
                },
            ],
        };
        this.methods = {
            resourceMapping: {
                async getMappingColumns() {
                    (0, collapsLogger_1.logCollapsOperation)('CollapsKeyColumnMapper', 'getMappingColumns()', { phase: 'START' }, 'Invocado desde resourceMapperMethod.');
                    try {
                        const { result, debug } = (0, mapperResourceMapper_1.resolveMapperResourceMapperFields)(this);
                        if (!Array.isArray(result.fields) || result.fields.length === 0) {
                            (0, collapsLogger_1.logCollapsOperation)('CollapsKeyColumnMapper', 'getMappingColumns()', debug, 'Sin columnas — retornando { fields: [] }.');
                            return { fields: [] };
                        }
                        (0, collapsLogger_1.logCollapsOperation)('CollapsKeyColumnMapper', 'getMappingColumns()', {
                            fieldsCount: result.fields.length,
                            fieldIds: result.fields.map((field) => field.id),
                        }, 'Retornando { fields: [...] } al resourceMapper.');
                        return result;
                    }
                    catch (error) {
                        (0, collapsLogger_1.logCollapsOperation)('CollapsKeyColumnMapper', 'getMappingColumns()', { error: error instanceof Error ? error.message : String(error) }, 'ERROR — retornando { fields: [] }.');
                        console.error('[KeyColumnMapper] getMappingColumns error:', error);
                        return { fields: [] };
                    }
                },
            },
        };
    }
    async execute() {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const returnData = [];
        try {
            const itemIndex = 0;
            const columnMapping = this.getNodeParameter('columnMapping', itemIndex);
            const keyA = readInputBranch(this, 0, 'Key A');
            const colsA = readInputBranch(this, 1, 'Columns A');
            const keyB = readInputBranch(this, 2, 'Key B');
            const colsB = readInputBranch(this, 3, 'Columns B');
            const schemaName = String((_d = (_c = (_b = (_a = keyA.schema) !== null && _a !== void 0 ? _a : colsA.schema) !== null && _b !== void 0 ? _b : keyB.schema) !== null && _c !== void 0 ? _c : colsB.schema) !== null && _d !== void 0 ? _d : '').trim();
            const llaveCruceA = (0, transformerPairing_1.firstColumn)(keyA.columns);
            const llaveCruceB = (0, transformerPairing_1.firstColumn)(keyB.columns);
            const columnsA = (0, transformerPairing_1.toColumnsArray)(colsA.columns);
            const columnsB = (0, transformerPairing_1.toColumnsArray)(colsB.columns);
            if (!schemaName) {
                throw new Error('Schema is required from the connected Column Selector inputs.');
            }
            if (!llaveCruceA || !llaveCruceB) {
                throw new Error('Key A and Key B must include at least one column in columns[].');
            }
            if (columnsA.length === 0 || columnsB.length === 0) {
                throw new Error('Columns A and Columns B cannot be empty.');
            }
            const mappedPairs = pairsFromResourceMapper(columnMapping);
            let pairs;
            let pairing_mode;
            if (mappedPairs.length > 0) {
                pairs = mappedPairs;
                pairing_mode = 'manual';
            }
            else {
                pairs = (0, transformerPairing_1.pairByIndex)(columnsA, columnsB).map((pair) => (0, transformerPairing_1.toPairOutput)(pair.column_a, pair.column_b, pair.index));
                pairing_mode = 'auto';
            }
            if (pairs.length === 0) {
                throw new Error('Could not build any column pairs.');
            }
            const bttfPayload = {
                source: 'n8n',
                analysis_id: `n8n_${Date.now()}`,
                schema_name: schemaName,
                tabla_a: String((_f = (_e = colsA.tableName) !== null && _e !== void 0 ? _e : keyA.tableName) !== null && _f !== void 0 ? _f : ''),
                tabla_b: String((_h = (_g = colsB.tableName) !== null && _g !== void 0 ? _g : keyB.tableName) !== null && _h !== void 0 ? _h : ''),
                llave_cruce_a: llaveCruceA,
                llave_cruce_b: llaveCruceB,
                columnas_a: pairs.map((pair) => pair.column_a).join(','),
                columnas_b: pairs.map((pair) => pair.column_b).join(','),
            };
            const emittedPayload = {
                bttfPayload,
                key_pair_label: buildKeyPairLabel(llaveCruceA, llaveCruceB),
                column_pairs: pairs,
                pairing_mode,
            };
            (0, collapsLogger_1.logCollapsOperation)('CollapsKeyColumnMapper', 'execute()', emittedPayload);
            returnData.push({
                json: emittedPayload,
            });
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), error);
        }
        return [returnData];
    }
}
exports.CollapsKeyColumnMapper = CollapsKeyColumnMapper;
