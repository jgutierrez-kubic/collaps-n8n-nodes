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
import {
	resolveLoadOptionsConnection,
	upstreamConnectionProperties,
} from '../helpers/loadOptionsConnection';
import {
	fetchTableNamesForSchema,
	readCurrentNodeString,
} from '../helpers/loadOptionsPostgres';
import { isValidSqlIdentifier } from '../helpers/sqlValidation';
import { readValidatedTableNameFromParameter } from '../helpers/upstreamContext';

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
			...upstreamConnectionProperties(),
			{
				displayName: 'Internal Schema Name',
				name: 'schemaName',
				type: 'hidden',
				default:
					'={{ $node["COLLAPS Schema Fetcher"].parameter["selectedSchema"] }}',
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

	methods = {
		loadOptions: {
			async getTableOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const logMeta = { node: NODE_NAME, context: 'getTableOptions()' };

				try {
					const connection = resolveLoadOptionsConnection(this);
					const schema = readCurrentNodeString(this, 'schemaName');
					if (!connection || !isValidSqlIdentifier(schema)) {
						logCollapsOperation(
							NODE_NAME,
							'getTableOptions()',
							{ hasConnection: Boolean(connection), schema: schema || null },
							'Previous nodes must be executed before loading tables.',
						);
						return [];
					}

					const tables = await fetchTableNamesForSchema(this, schema, logMeta, connection);

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
				const schema = String(
					this.getNodeParameter('schemaName', itemIndex, ''),
				).trim();
				const tableName = readValidatedTableNameFromParameter(
					this.getNodeParameter('tableName', itemIndex, ''),
				);

				if (!isValidSqlIdentifier(schema)) {
					throw new Error(
						'Schema Name is unavailable. Execute COLLAPS Schema Fetcher first.',
					);
				}
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
