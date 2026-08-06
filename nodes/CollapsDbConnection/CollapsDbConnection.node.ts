import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { resolveConnectionConfig, withPostgresConnection } from '../helpers/postgresClient';

interface DbConnectionOutput {
	host: string;
	port: number;
	database: string;
	user: string;
	password: string;
	status: 'CONNECTED';
}

export class CollapsDbConnection implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'COLLAPS Database Connection',
		name: 'collapsDbConnection',
		icon: 'fa:plug',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["host"]}} / {{$parameter["database"]}}',
		description:
			'COLLAPS connection node. Emits active configuration and validates connectivity against PostgreSQL.',
		defaults: {
			name: 'COLLAPS Database Connection',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Host',
				name: 'host',
				type: 'string',
				default: '',
				required: true,
				description: 'PostgreSQL host. No implicit host is used.',
			},
			{
				displayName: 'Port',
				name: 'port',
				type: 'number',
				default: 5432,
				required: true,
			},
			{
				displayName: 'Database',
				name: 'database',
				type: 'string',
				default: '',
				required: true,
			},
			{
				displayName: 'User',
				name: 'user',
				type: 'string',
				default: '',
				required: true,
			},
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: {
					password: true,
				},
				default: '',
				required: true,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const input = items[itemIndex]?.json ?? {};
				const connection = resolveConnectionConfig(input, {
					host: this.getNodeParameter('host', itemIndex, '') as string,
					port: this.getNodeParameter('port', itemIndex, 5432) as number,
					database: this.getNodeParameter('database', itemIndex, '') as string,
					user: this.getNodeParameter('user', itemIndex, '') as string,
					password: this.getNodeParameter('password', itemIndex, '') as string,
				});
				if (!connection) {
					throw new Error('Host, port, database, user and password are required.');
				}

				await withPostgresConnection(connection, async (client) => {
					await client.query('SELECT 1');
				});

				const output: DbConnectionOutput = {
					host: connection.host,
					port: connection.port,
					database: connection.database,
					user: connection.user,
					password: connection.password,
					status: 'CONNECTED',
				};

				returnData.push({
					json: output as unknown as IDataObject,
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				throw new NodeOperationError(this.getNode(), error as Error);
			}
		}

		return [returnData];
	}
}
