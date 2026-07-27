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

import { logCollapsOperation } from '../helpers/collapsLogger';
import { fetchTableNamesForSchema } from '../helpers/loadOptionsPostgres';
import {
	readSchemaFromUpstreamInput,
	readValidatedTableNameFromParameter,
	tryGetUpstreamJson,
} from '../helpers/upstreamContext';

const NODE_NAME = 'CollapsTableSelector';

interface TableSelectorOutput {
	schema: string;
	tableName: string;
}

export class CollapsTableSelector implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'COLLAPS Table Selector',
		name: 'collapsTableSelector',
		icon: 'fa:table',
		group: ['transform'],
		version: 2,
		subtitle: '={{$parameter["tableName"]}}',
		description:
			'Discovers tables from PostgreSQL and lets you select one. Replaces Table Fetcher + Table Picker.',
		defaults: {
			name: 'COLLAPS Table Selector',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Automated Discovery',
				name: 'discoveryNotice',
				type: 'notice',
				default: '',
				description:
					'Tables are loaded live from PostgreSQL using the schema from the upstream Schema Fetcher connection.',
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

	methods = {
		loadOptions: {
			async getTableOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const upstream = await tryGetUpstreamJson(this);
					const schema = readSchemaFromUpstreamInput(upstream);
					const tables = await fetchTableNamesForSchema(this, schema, {
						node: NODE_NAME,
						context: 'getTableOptions()',
					});

					const options = tables.map((table) => ({
						name: table,
						value: table,
					}));

					logCollapsOperation(
						NODE_NAME,
						'getTableOptions()',
						options.map((option) => option.value),
						`Tablas cargadas para schema "${schema}".`,
					);

					return options;
				} catch (error) {
					console.error(`[${NODE_NAME}] getTableOptions error:`, error);
					return [];
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const input = items[itemIndex]?.json ?? {};
				const schema = readSchemaFromUpstreamInput(input);
				const tableName = readValidatedTableNameFromParameter(
					this.getNodeParameter('tableName', itemIndex, ''),
				);

				if (!tableName) {
					throw new NodeOperationError(
						this.getNode(),
						new Error(
							'No se seleccionó una tabla válida. Elija una opción del dropdown Table Name.',
						),
					);
				}

				const output: TableSelectorOutput = {
					schema,
					tableName,
				};

				logCollapsOperation(NODE_NAME, 'execute()', output);

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
