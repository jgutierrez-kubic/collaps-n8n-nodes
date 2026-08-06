"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollapsSchemaFetcher = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const postgresClient_1 = require("../helpers/postgresClient");
const collapsLogger_1 = require("../helpers/collapsLogger");
const loadOptionsConnection_1 = require("../helpers/loadOptionsConnection");
const schemaQueries_1 = require("../helpers/schemaQueries");
class CollapsSchemaFetcher {
    constructor() {
        this.description = {
            displayName: 'COLLAPS Schema Fetcher',
            name: 'collapsSchemaFetcher',
            icon: 'fa:sitemap',
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["selectedSchema"] || "all schemas"}}',
            description: 'Queries real PostgreSQL schemas (pg_namespace with fallback) and allows selecting one for downstream nodes.',
            defaults: {
                name: 'COLLAPS Schema Fetcher',
            },
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            properties: [
                ...(0, loadOptionsConnection_1.upstreamConnectionProperties)(),
                {
                    displayName: 'Selected Schema',
                    name: 'selectedSchema',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSchemaOptions',
                        loadOptionsDependsOn: [
                            'connectionHost',
                            'connectionPort',
                            'connectionDatabase',
                            'connectionUser',
                            'connectionPassword',
                        ],
                        searchable: true,
                    },
                    default: '',
                    required: true,
                    placeholder: 'Requiere ejecución de nodos previos',
                    description: 'Selected schema from the real catalog',
                },
            ],
        };
        this.methods = {
            loadOptions: {
                async getSchemaOptions() {
                    const connection = (0, loadOptionsConnection_1.resolveLoadOptionsConnection)(this);
                    if (!connection) {
                        return [];
                    }
                    try {
                        return await (0, postgresClient_1.withPostgresConnection)(connection, async (client) => {
                            const schemasList = await (0, schemaQueries_1.fetchRealSchemas)(client, 'CollapsSchemaFetcher', 'getSchemaOptions()');
                            if (!Array.isArray(schemasList)) {
                                return [];
                            }
                            const options = schemasList.map((schemaName) => ({
                                name: String(schemaName),
                                value: String(schemaName),
                            }));
                            (0, collapsLogger_1.logCollapsOperation)('CollapsSchemaFetcher', 'getSchemaOptions()', options.map((option) => option.value), 'Opciones de esquema cargadas para el dropdown.');
                            return options;
                        });
                    }
                    catch {
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
                const connection = (0, postgresClient_1.resolveConnectionConfig)(input);
                if (!connection) {
                    throw new Error('Valid PostgreSQL credentials are required from COLLAPS Database Connection.');
                }
                const selectedSchema = this.getNodeParameter('selectedSchema', itemIndex, '');
                const output = await (0, postgresClient_1.withPostgresConnection)(connection, async (client) => {
                    const schemas = await (0, schemaQueries_1.fetchRealSchemas)(client, 'CollapsSchemaFetcher', 'execute()');
                    const schema = (0, postgresClient_1.resolveSchemaFromStream)(selectedSchema, {
                        ...input,
                        selectedSchema,
                        schema: selectedSchema,
                    });
                    if (!schema) {
                        throw new Error('Selected Schema is required. Execute the Database Connection and select a schema.');
                    }
                    const payload = {
                        totalSchemas: schemas.length,
                        schemas,
                        host: connection.host,
                        port: connection.port,
                        database: connection.database,
                        user: connection.user,
                    };
                    const result = {
                        ...payload,
                        schema,
                        selectedSchema: schema,
                    };
                    (0, collapsLogger_1.logCollapsOperation)('CollapsSchemaFetcher', 'execute()', {
                        schema: result.schema,
                        totalSchemas: result.totalSchemas,
                        schemas: result.schemas,
                    });
                    return result;
                });
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
exports.CollapsSchemaFetcher = CollapsSchemaFetcher;
