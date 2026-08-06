import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { quoteIdentifier, resolveConnectionConfig, resolveSelectorSchema, withPostgresConnection } from '../helpers/postgresClient';

function resolveSchema(schemaParam: string | undefined, input: IDataObject): string {
	return resolveSelectorSchema((schemaParam || (input.schema as string) || '').trim());
}

function resolveTableName(tableParam: string | undefined, input: IDataObject): string {
	return (tableParam || (input.tableName as string) || '').trim();
}

export class CollapsDataWatcher implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'COLLAPS Data Watcher',
		name: 'collapsDataWatcher',
		icon: 'fa:eye',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["schema"]}}.{{$parameter["tableName"]}}',
		description:
			'Dynamo/Grasshopper-style Watch node. Runs SELECT * LIMIT 10 for visual inspection in the n8n OUTPUT panel.',
		defaults: {
			name: 'COLLAPS Data Watcher',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const input = items[itemIndex]?.json ?? {};
				const schema = resolveSchema(
					this.getNodeParameter('schema', itemIndex, '') as string,
					input,
				);
				const tableName = resolveTableName(
					this.getNodeParameter('tableName', itemIndex, '') as string,
					input,
				);

				if (!tableName) {
					returnData.push({
						json: {
							warning: true,
							schema,
							tableName: null,
							message:
								'tableName not defined in input or parameters. Inspection skipped (workflow continues).',
						},
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				const connection = resolveConnectionConfig(input);
				if (!connection) {
					throw new Error(
						'Valid PostgreSQL credentials are required from COLLAPS Database Connection.',
					);
				}
				const qualifiedTable = `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`;

				const rows = await withPostgresConnection(connection, async (client) => {
					const result = await client.query(`SELECT * FROM ${qualifiedTable} LIMIT 10`);
					return result.rows as IDataObject[];
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
			} catch (error) {
				throw new NodeOperationError(this.getNode(), error as Error);
			}
		}

		return [returnData];
	}
}
