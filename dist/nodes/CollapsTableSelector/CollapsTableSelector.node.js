"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollapsTableSelector = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const collapsLogger_1 = require("../helpers/collapsLogger");
const loadOptionsConnection_1 = require("../helpers/loadOptionsConnection");
const loadOptionsPostgres_1 = require("../helpers/loadOptionsPostgres");
const sqlValidation_1 = require("../helpers/sqlValidation");
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
                ...(0, loadOptionsConnection_1.upstreamConnectionProperties)(),
                {
                    displayName: 'Internal Schema Name',
                    name: 'schemaName',
                    type: 'hidden',
                    default: '={{ $node["COLLAPS Schema Fetcher"].parameter["selectedSchema"] }}',
                },
                {
                    displayName: 'Table Name',
                    name: 'tableName',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getTableOptions',
                        loadOptionsDependsOn: [
                            'schemaName',
                            'connectionHost',
                            'connectionPort',
                            'connectionDatabase',
                            'connectionUser',
                            'connectionPassword',
                        ],
                        searchable: true,
                    },
                    default: '',
                    required: false,
                    placeholder: 'Requiere ejecución de nodos previos',
                    description: 'Single table selection from information_schema.tables.',
                },
            ],
        };
        this.methods = {
            loadOptions: {
                async getTableOptions() {
                    const logMeta = { node: NODE_NAME, context: 'getTableOptions()' };
                    try {
                        const connection = (0, loadOptionsConnection_1.resolveLoadOptionsConnection)(this);
                        const schema = (0, loadOptionsPostgres_1.readCurrentNodeString)(this, 'schemaName');
                        if (!connection || !(0, sqlValidation_1.isValidSqlIdentifier)(schema)) {
                            (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'getTableOptions()', { hasConnection: Boolean(connection), schema: schema || null }, 'Previous nodes must be executed before loading tables.');
                            return [];
                        }
                        const tables = await (0, loadOptionsPostgres_1.fetchTableNamesForSchema)(this, schema, logMeta, connection);
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
        const items = this.getInputData();
        const returnData = [];
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const schema = String(this.getNodeParameter('schemaName', itemIndex, '')).trim();
                const tableName = (0, upstreamContext_1.readValidatedTableNameFromParameter)(this.getNodeParameter('tableName', itemIndex, ''));
                if (!(0, sqlValidation_1.isValidSqlIdentifier)(schema)) {
                    throw new Error('Schema Name is unavailable. Execute COLLAPS Schema Fetcher first.');
                }
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
