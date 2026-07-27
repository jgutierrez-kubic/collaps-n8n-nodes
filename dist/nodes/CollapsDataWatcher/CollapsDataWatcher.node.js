"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollapsDataWatcher = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const postgresClient_1 = require("../helpers/postgresClient");
function resolveSchema(schemaParam, input) {
    return (0, postgresClient_1.resolveSelectorSchema)((schemaParam || input.schema || '').trim());
}
function resolveTableName(tableParam, input) {
    return (tableParam || input.tableName || '').trim();
}
class CollapsDataWatcher {
    constructor() {
        this.description = {
            displayName: 'COLLAPS Data Watcher',
            name: 'collapsDataWatcher',
            icon: 'fa:eye',
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["schema"]}}.{{$parameter["tableName"]}}',
            description: 'Dynamo/Grasshopper-style Watch node. Runs SELECT * LIMIT 10 for visual inspection in the n8n OUTPUT panel.',
            defaults: {
                name: 'COLLAPS Data Watcher',
            },
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            properties: [
                {
                    displayName: 'Schema',
                    name: 'schema',
                    type: 'string',
                    default: '={{ $json.schema }}',
                    required: false,
                    description: 'Schema to inspect. Inherited from upstream flow.',
                },
                {
                    displayName: 'Table Name',
                    name: 'tableName',
                    type: 'string',
                    default: '={{ $json.tableName }}',
                    required: false,
                    description: 'Table to inspect. Inherited from upstream flow.',
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
                const schema = resolveSchema(this.getNodeParameter('schema', itemIndex, ''), input);
                const tableName = resolveTableName(this.getNodeParameter('tableName', itemIndex, ''), input);
                if (!tableName) {
                    returnData.push({
                        json: {
                            warning: true,
                            schema,
                            tableName: null,
                            message: 'tableName not defined in input or parameters. Inspection skipped (workflow continues).',
                        },
                        pairedItem: { item: itemIndex },
                    });
                    continue;
                }
                const connection = (0, postgresClient_1.resolveConnectionConfig)(input);
                const qualifiedTable = `${(0, postgresClient_1.quoteIdentifier)(schema)}.${(0, postgresClient_1.quoteIdentifier)(tableName)}`;
                const rows = await (0, postgresClient_1.withPostgresConnection)(connection, async (client) => {
                    const result = await client.query(`SELECT * FROM ${qualifiedTable} LIMIT 10`);
                    return result.rows;
                });
                if (rows.length === 0) {
                    returnData.push({
                        json: {
                            schema,
                            tableName,
                            rowCount: 0,
                            preview: [],
                            message: 'Table has no visible rows.',
                        },
                        pairedItem: { item: itemIndex },
                    });
                    continue;
                }
                for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                    returnData.push({
                        json: {
                            ...rows[rowIndex],
                            _watcher: {
                                schema,
                                tableName,
                                rowIndex,
                                rowCount: rows.length,
                            },
                        },
                        pairedItem: { item: itemIndex },
                    });
                }
            }
            catch (error) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error);
            }
        }
        return [returnData];
    }
}
exports.CollapsDataWatcher = CollapsDataWatcher;
