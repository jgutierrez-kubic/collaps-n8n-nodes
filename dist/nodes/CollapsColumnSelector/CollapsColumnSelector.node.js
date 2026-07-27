"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollapsColumnSelector = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const collapsLogger_1 = require("../helpers/collapsLogger");
const loadOptionsPostgres_1 = require("../helpers/loadOptionsPostgres");
const upstreamContext_1 = require("../helpers/upstreamContext");
const NODE_NAME = 'CollapsColumnSelector';
class CollapsColumnSelector {
    constructor() {
        this.description = {
            displayName: 'COLLAPS Column Selector',
            name: 'collapsColumnSelector',
            icon: 'fa:columns',
            group: ['transform'],
            version: 3,
            subtitle: '={{ $parameter["columns"] && $parameter["columns"].length > 0 ? $parameter["columns"].slice(0, 3).join(", ") + ($parameter["columns"].length > 3 ? "..." : "") : "No columns selected" }}',
            description: 'Discovers columns from PostgreSQL and lets you pick only what you need. Replaces Column Fetcher + Column Picker.',
            defaults: {
                name: 'COLLAPS Column Selector',
            },
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            properties: [
                {
                    displayName: 'Automated Discovery',
                    name: 'discoveryNotice',
                    type: 'notice',
                    default: '',
                    description: 'Columns are loaded live from PostgreSQL using schema and tableName from the upstream Table Selector.',
                },
                {
                    displayName: 'Upstream Schema',
                    name: 'upstreamSchema',
                    type: 'hidden',
                    default: '={{ $json.schema }}',
                },
                {
                    displayName: 'Upstream Table Name',
                    name: 'upstreamTableName',
                    type: 'hidden',
                    default: '={{ $json.tableName }}',
                },
                {
                    displayName: 'Columns',
                    name: 'columns',
                    type: 'multiOptions',
                    typeOptions: {
                        loadOptionsMethod: 'getColumnOptions',
                        loadOptionsDependsOn: ['upstreamSchema', 'upstreamTableName'],
                        searchable: true,
                    },
                    default: [],
                    required: false,
                    description: 'Pick only the columns you need. Nothing is pre-selected.',
                },
            ],
        };
        this.methods = {
            loadOptions: {
                async getColumnOptions() {
                    (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'getColumnOptions()', { status: 'invoked' }, 'ENTRY — loadOptions hook fired.');
                    try {
                        const { schema, tableName } = await (0, upstreamContext_1.resolveContextForColumnSelector)(this);
                        (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'getColumnOptions()', { schema, tableName }, 'Contexto resuelto antes de SQL.');
                        if (!tableName) {
                            return [];
                        }
                        const options = await (0, loadOptionsPostgres_1.fetchColumnPropertyOptions)(this, schema, tableName, { node: NODE_NAME, context: 'getColumnOptions()' });
                        (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'getColumnOptions()', options.map((option) => option.value), `Columnas cargadas vía SQL live para ${schema}.${tableName}.`);
                        return options;
                    }
                    catch (error) {
                        (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'getColumnOptions()', { error: error instanceof Error ? error.message : String(error) }, 'ERROR en getColumnOptions.');
                        return [];
                    }
                },
            },
        };
    }
    async execute() {
        var _a, _b;
        const items = this.getInputData();
        const returnData = [];
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const input = (_b = (_a = items[itemIndex]) === null || _a === void 0 ? void 0 : _a.json) !== null && _b !== void 0 ? _b : {};
                const schema = String(this.getNodeParameter('upstreamSchema', itemIndex, '')).trim() ||
                    (0, upstreamContext_1.readSchemaFromUpstreamInput)(input);
                const tableName = (0, upstreamContext_1.readValidatedTableNameFromParameter)(this.getNodeParameter('upstreamTableName', itemIndex, '')) || (0, upstreamContext_1.readValidatedTableNameFromInput)(input);
                if (!tableName) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), new Error("No se recibió 'tableName' válido desde el nodo anterior."));
                }
                const selectedColumns = this.getNodeParameter('columns', itemIndex, []);
                const output = {
                    schema,
                    tableName,
                    columns: selectedColumns
                        .map((column) => String(column).trim())
                        .filter(Boolean),
                };
                (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'execute()', output);
                returnData.push({
                    json: output,
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
exports.CollapsColumnSelector = CollapsColumnSelector;
