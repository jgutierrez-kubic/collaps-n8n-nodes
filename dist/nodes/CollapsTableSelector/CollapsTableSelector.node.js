"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollapsTableSelector = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const collapsLogger_1 = require("../helpers/collapsLogger");
const loadOptionsPostgres_1 = require("../helpers/loadOptionsPostgres");
const upstreamContext_1 = require("../helpers/upstreamContext");
const NODE_NAME = 'CollapsTableSelector';
class CollapsTableSelector {
    constructor() {
        this.description = {
            displayName: 'COLLAPS Table Selector',
            name: 'collapsTableSelector',
            icon: 'fa:table',
            group: ['transform'],
            version: 2,
            subtitle: '={{$parameter["tableName"]}}',
            description: 'Discovers tables from PostgreSQL and lets you select one. Replaces Table Fetcher + Table Picker.',
            defaults: {
                name: 'COLLAPS Table Selector',
            },
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            properties: [
                {
                    displayName: 'Automated Discovery',
                    name: 'discoveryNotice',
                    type: 'notice',
                    default: '',
                    description: 'Tables are loaded live from PostgreSQL using the schema from the upstream Schema Fetcher connection.',
                },
                {
                    displayName: 'Table Name',
                    name: 'tableName',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getTableOptions',
                        searchable: true,
                    },
                    default: '',
                    required: false,
                    placeholder: 'Select a table',
                    description: 'Single table selection from information_schema.tables.',
                },
            ],
        };
        this.methods = {
            loadOptions: {
                async getTableOptions() {
                    try {
                        const upstream = await (0, upstreamContext_1.tryGetUpstreamJson)(this);
                        const schema = (0, upstreamContext_1.readSchemaFromUpstreamInput)(upstream);
                        const tables = await (0, loadOptionsPostgres_1.fetchTableNamesForSchema)(this, schema, {
                            node: NODE_NAME,
                            context: 'getTableOptions()',
                        });
                        const options = tables.map((table) => ({
                            name: table,
                            value: table,
                        }));
                        (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'getTableOptions()', options.map((option) => option.value), `Tablas cargadas para schema "${schema}".`);
                        return options;
                    }
                    catch (error) {
                        console.error(`[${NODE_NAME}] getTableOptions error:`, error);
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
                const schema = (0, upstreamContext_1.readSchemaFromUpstreamInput)(input);
                const tableName = (0, upstreamContext_1.readValidatedTableNameFromParameter)(this.getNodeParameter('tableName', itemIndex, ''));
                if (!tableName) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), new Error('No se seleccionó una tabla válida. Elija una opción del dropdown Table Name.'));
                }
                const output = {
                    schema,
                    tableName,
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
exports.CollapsTableSelector = CollapsTableSelector;
