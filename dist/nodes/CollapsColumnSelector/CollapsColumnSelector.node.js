"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollapsColumnSelector = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const collapsLogger_1 = require("../helpers/collapsLogger");
const loadOptionsConnection_1 = require("../helpers/loadOptionsConnection");
const loadOptionsPostgres_1 = require("../helpers/loadOptionsPostgres");
const sqlValidation_1 = require("../helpers/sqlValidation");
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
                ...(0, loadOptionsConnection_1.upstreamConnectionProperties)(),
                {
                    displayName: 'Internal Schema Name',
                    name: 'schemaName',
                    type: 'hidden',
                    default: '={{ $json.schema || "" }}',
                },
                {
                    displayName: 'Internal Table Name',
                    name: 'tableName',
                    type: 'hidden',
                    default: '={{ $json.tableName || "" }}',
                },
                {
                    displayName: 'Columns',
                    name: 'columns',
                    type: 'multiOptions',
                    typeOptions: {
                        loadOptionsMethod: 'getColumnOptions',
                        loadOptionsDependsOn: [
                            'schemaName',
                            'tableName',
                            'connectionHost',
                            'connectionPort',
                            'connectionDatabase',
                            'connectionUser',
                            'connectionPassword',
                        ],
                        searchable: true,
                    },
                    default: [],
                    required: false,
                    placeholder: 'Requiere ejecución de nodos previos',
                    description: 'Pick only the columns you need. Nothing is pre-selected.',
                },
            ],
        };
        this.methods = {
            loadOptions: {
                async getColumnOptions() {
                    (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'getColumnOptions()', { status: 'invoked' }, 'ENTRY — loadOptions hook fired.');
                    const logMeta = { node: NODE_NAME, context: 'getColumnOptions()' };
                    try {
                        const connection = (0, loadOptionsConnection_1.resolveLoadOptionsConnection)(this);
                        const schema = (0, loadOptionsPostgres_1.readCurrentNodeString)(this, 'schemaName');
                        const tableName = (0, upstreamContext_1.readValidatedTableNameFromParameter)((0, loadOptionsPostgres_1.readCurrentNodeString)(this, 'tableName'));
                        (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'getColumnOptions()', { schema, tableName }, 'Contexto resuelto antes de SQL.');
                        if (!connection || !(0, sqlValidation_1.isValidSqlIdentifier)(schema) || !tableName) {
                            return [];
                        }
                        const options = await (0, loadOptionsPostgres_1.fetchColumnPropertyOptions)(this, schema, tableName, logMeta, connection);
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
        var _a, _b, _c;
        const items = this.getInputData();
        const returnData = [];
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const input = (_b = (_a = items[itemIndex]) === null || _a === void 0 ? void 0 : _a.json) !== null && _b !== void 0 ? _b : {};
                const schema = String((_c = input.schema) !== null && _c !== void 0 ? _c : '').trim();
                const tableName = (0, upstreamContext_1.readValidatedTableNameFromParameter)(input.tableName);
                if (!(0, sqlValidation_1.isValidSqlIdentifier)(schema) || !tableName) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), new Error('Schema Name or Table Name is unavailable. Execute COLLAPS Table Selector first.'));
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
