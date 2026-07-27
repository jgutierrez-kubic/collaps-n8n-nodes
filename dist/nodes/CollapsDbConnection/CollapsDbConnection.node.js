"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollapsDbConnection = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const postgresClient_1 = require("../helpers/postgresClient");
class CollapsDbConnection {
    constructor() {
        this.description = {
            displayName: 'COLLAPS Database Connection',
            name: 'collapsDbConnection',
            icon: 'fa:plug',
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["host"]}} / {{$parameter["database"]}}',
            description: 'COLLAPS connection node. Emits active configuration and validates connectivity against PostgreSQL.',
            defaults: {
                name: 'COLLAPS Database Connection',
            },
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            properties: [
                {
                    displayName: 'Host',
                    name: 'host',
                    type: 'string',
                    default: postgresClient_1.CLOUDSQL_PUBLIC_HOST,
                    required: false,
                    description: 'PostgreSQL host. Default: COLLAPS public IP',
                },
                {
                    displayName: 'Port',
                    name: 'port',
                    type: 'number',
                    default: 5432,
                    required: false,
                },
                {
                    displayName: 'Database',
                    name: 'database',
                    type: 'string',
                    default: postgresClient_1.DEFAULT_POSTGRES_CREDENTIALS.database,
                    required: false,
                },
                {
                    displayName: 'User',
                    name: 'user',
                    type: 'string',
                    default: postgresClient_1.DEFAULT_POSTGRES_CREDENTIALS.user,
                    required: false,
                },
                {
                    displayName: 'Password',
                    name: 'password',
                    type: 'string',
                    typeOptions: {
                        password: true,
                    },
                    default: postgresClient_1.DEFAULT_POSTGRES_CREDENTIALS.password,
                    required: false,
                },
            ],
        };
    }
    async execute() {
        var _a, _b;
        const items = this.getInputData();
        const returnData = [];
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const input = (_b = (_a = items[itemIndex]) === null || _a === void 0 ? void 0 : _a.json) !== null && _b !== void 0 ? _b : {};
                const connection = (0, postgresClient_1.resolveConnectionConfig)(input, {
                    host: this.getNodeParameter('host', itemIndex, postgresClient_1.CLOUDSQL_PUBLIC_HOST),
                    port: this.getNodeParameter('port', itemIndex, 5432),
                    database: this.getNodeParameter('database', itemIndex, 'collaps'),
                    user: this.getNodeParameter('user', itemIndex, 'n8n_user'),
                    password: this.getNodeParameter('password', itemIndex, ''),
                });
                await (0, postgresClient_1.withPostgresConnection)(connection, async (client) => {
                    await client.query('SELECT 1');
                });
                const output = {
                    host: connection.host,
                    port: connection.port,
                    database: connection.database,
                    user: connection.user,
                    password: connection.password,
                    status: 'CONNECTED',
                };
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
exports.CollapsDbConnection = CollapsDbConnection;
