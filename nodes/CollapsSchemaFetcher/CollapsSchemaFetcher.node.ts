import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	resolveConnectionConfig,
	resolveSchemaFromStream,
	withPostgresConnection,
} from '../helpers/postgresClient';
import { logCollapsOperation } from '../helpers/collapsLogger';
import { fetchRealSchemas } from '../helpers/schemaQueries';

interface SchemaFetcherOutput {
	totalSchemas: number;
	schemas: string[];
	host: string;
	port: number;
	database: string;
	user: string;
}

export class CollapsSchemaFetcher implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'COLLAPS Schema Fetcher',
		name: 'collapsSchemaFetcher',
		icon: 'fa:sitemap',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["selectedSchema"] || "all schemas"}}',
		description:
			'Queries real PostgreSQL schemas (pg_namespace with fallback) and allows selecting one for downstream nodes.',
		defaults: {
			name: 'COLLAPS Schema Fetcher',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Selected Schema',
				name: 'selectedSchema',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getSchemaOptions',
					searchable: true,
				},
				default: '',
				required: false,
				placeholder: 'Select or type schema (e.g. s00001_incancer)',
				description: 'Selected schema from the real catalog',
			},
		],
	};

	methods = {
		loadOptions: {
			async getSchemaOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const connection = resolveConnectionConfig({});

				return withPostgresConnection(connection, async (client) => {
					const schemasList = await fetchRealSchemas(
						client,
						'CollapsSchemaFetcher',
						'getSchemaOptions()',
					);
					if (!Array.isArray(schemasList)) {
						return [];
					}

					const options = schemasList.map((schemaName) => ({
						name: String(schemaName),
						value: String(schemaName),
					}));

					logCollapsOperation(
						'CollapsSchemaFetcher',
						'getSchemaOptions()',
						options.map((option) => option.value),
						'Opciones de esquema cargadas para el dropdown.',
					);

					return options;
				});
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const input = items[itemIndex]?.json ?? {};
				const connection = resolveConnectionConfig(input);
				const selectedSchema = this.getNodeParameter('selectedSchema', itemIndex, '') as string;

				const output = await withPostgresConnection(connection, async (client) => {
					const schemas = await fetchRealSchemas(client, 'CollapsSchemaFetcher', 'execute()');
					const schema = resolveSchemaFromStream(selectedSchema, {
						...input,
						selectedSchema,
						schema: selectedSchema,
					});

					const payload: SchemaFetcherOutput = {
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

					logCollapsOperation('CollapsSchemaFetcher', 'execute()', {
						schema: result.schema,
						totalSchemas: result.totalSchemas,
						schemas: result.schemas,
					});

					return result;
				});

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
