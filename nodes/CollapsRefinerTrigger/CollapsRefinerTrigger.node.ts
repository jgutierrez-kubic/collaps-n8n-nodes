import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { logCollapsOperation } from '../helpers/collapsLogger';
import {
	connectionFromInput,
	upstreamConnectionProperties,
} from '../helpers/loadOptionsConnection';
import {
	quoteIdentifier,
	resolveConnectionConfig,
	withPostgresConnection,
	type PostgresCredentials,
} from '../helpers/postgresClient';
import { isValidSqlIdentifier } from '../helpers/sqlValidation';

const NODE_NAME = 'CollapsRefinerTrigger';
const CONFIG_TABLE = 'a_2_config_ingesta_a';
const CATALYST_URL =
	'https://bttf-engine-31997537275.us-central1.run.app/api/v1/catalyst/job';
const PRODUCTION_N8N_BASE_URL =
	'https://n8n-collaps-31997537275.us-central1.run.app';

function resolveCallbackUrl(context: IExecuteFunctions): string {
	const executionId = context.getExecutionId();
	return `${PRODUCTION_N8N_BASE_URL}/webhook-waiting/${encodeURIComponent(executionId)}`;
}

function readResolvedParameter(
	context: IExecuteFunctions,
	name: string,
	itemIndex: number,
): string {
	const value = String(context.getNodeParameter(name, itemIndex, '') ?? '').trim();
	return value.startsWith('=') || value.includes('{{') ? '' : value;
}

function resolveExecuteConnection(
	context: IExecuteFunctions,
	itemIndex: number,
	input: IDataObject,
): PostgresCredentials | null {
	const fromInput = connectionFromInput(input) ?? resolveConnectionConfig(input);
	if (fromInput) {
		return fromInput;
	}

	return resolveConnectionConfig(
		{},
		{
			host: readResolvedParameter(context, 'connectionHost', itemIndex),
			port: Number(context.getNodeParameter('connectionPort', itemIndex, 0)),
			database: readResolvedParameter(context, 'connectionDatabase', itemIndex),
			user: readResolvedParameter(context, 'connectionUser', itemIndex),
			password: readResolvedParameter(context, 'connectionPassword', itemIndex),
		},
	);
}

export class CollapsRefinerTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'COLLAPS Refiner Trigger',
		name: 'collapsRefinerTrigger',
		icon: 'fa:flask',
		group: ['transform'],
		version: 1,
		subtitle: 'Catalyst Job',
		description:
			'Triggers the async COLLAPS Catalyst (refiner) job on Cloud Run and injects callbackUrl for n8n Wait resume.',
		defaults: {
			name: 'COLLAPS Refiner Trigger',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			...upstreamConnectionProperties(),
			{
				displayName: 'Internal Schema Name',
				name: 'schemaName',
				type: 'hidden',
				default: '={{ $json.schema || "" }}',
			},
			{
				displayName: 'Internal Source Table',
				name: 'sourceTable',
				type: 'hidden',
				default: '={{ $json.tableName || "" }}',
			},
			{
				displayName: 'Internal Callback URL',
				name: 'callbackUrl',
				type: 'hidden',
				default: '',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < Math.max(items.length, 1); itemIndex++) {
			try {
				const input = items[itemIndex]?.json ?? items[0]?.json ?? {};

				const schemaName =
					String(this.getNodeParameter('schemaName', itemIndex, '')).trim() ||
					String(input.schema ?? input.schemaName ?? '').trim();
				const sourceTable =
					String(this.getNodeParameter('sourceTable', itemIndex, '')).trim() ||
					String(input.tableName ?? input.sourceTable ?? '').trim();

				if (!schemaName || !isValidSqlIdentifier(schemaName)) {
					throw new Error('A valid Schema Name is required.');
				}
				if (!sourceTable || !isValidSqlIdentifier(sourceTable)) {
					throw new Error('A valid Source Table is required.');
				}

				const connection = resolveExecuteConnection(this, itemIndex, input);
				if (!connection) {
					throw new Error(
						'No se recibieron credenciales válidas desde COLLAPS Database Connection.',
					);
				}

				const configuredColumns = await withPostgresConnection(
					connection,
					async (client) => {
						const configTable = `${quoteIdentifier(schemaName)}.${quoteIdentifier(CONFIG_TABLE)}`;
						const result = await client.query<{ configured_count: string | number }>(
							`SELECT count(*) AS configured_count
							 FROM ${configTable}
							 WHERE tabla = $1
							   AND guardar = TRUE`,
							[sourceTable],
						);

						return Number(result.rows[0]?.configured_count ?? 0);
					},
				);

				if (configuredColumns === 0) {
					throw new Error(
						`La tabla ${sourceTable} no ha sido configurada en NocoDB.`,
					);
				}

				const callbackUrl = resolveCallbackUrl(this);

				const payloadToSend: IDataObject = {
					source: 'n8n',
					schemaName,
					sourceTable,
					callbackUrl,
				};

				logCollapsOperation(
					NODE_NAME,
					'execute()',
					{ phase: 'catalyst_request', payloadToSend },
					'POST /api/v1/catalyst/job — async refiner job.',
				);

				const apiResponse = (await this.helpers.request({
					method: 'POST',
					uri: CATALYST_URL,
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
					},
					body: payloadToSend,
					json: true,
				})) as IDataObject;

				const emittedPayload = {
					request: payloadToSend,
					response: apiResponse,
				};

				logCollapsOperation(
					NODE_NAME,
					'execute()',
					emittedPayload,
					'Catalyst job accepted (HTTP 202 expected). Use Wait node for callback resume.',
				);

				returnData.push(
					...this.helpers.returnJsonArray({
						request: payloadToSend,
						response: apiResponse,
					}),
				);
			} catch (error) {
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}
