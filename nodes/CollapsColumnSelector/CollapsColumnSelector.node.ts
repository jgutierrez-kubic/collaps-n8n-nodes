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
	fetchColumnPropertyOptions,
	readCurrentNodeString,
} from '../helpers/loadOptionsPostgres';
import { isValidSqlIdentifier } from '../helpers/sqlValidation';
import { readValidatedTableNameFromParameter } from '../helpers/upstreamContext';

const NODE_NAME = 'CollapsColumnSelector';

interface ColumnSelectorOutput {
	schema: string;
	tableName: string;
	columns: string[];
}

export class CollapsColumnSelector implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'COLLAPS Column Selector',
		name: 'collapsColumnSelector',
		icon: 'fa:columns',
		group: ['transform'],
		version: 3,
		subtitle:
			'={{ $parameter["columns"] && $parameter["columns"].length > 0 ? $parameter["columns"].slice(0, 3).join(", ") + ($parameter["columns"].length > 3 ? "..." : "") : "No columns selected" }}',
		description:
			'Discovers columns from PostgreSQL and lets you pick only what you need. Replaces Column Fetcher + Column Picker.',
		defaults: {
			name: 'COLLAPS Column Selector',
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
				displayName: 'Internal Table Name',
				name: 'tableName',
				type: 'hidden',
				default: '={{ $json.tableName || "" }}',
			},
			{
				displayName: 'Columns',
				name: 'columns',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getColumnOptions',
					loadOptionsDependsOn: [
						'schemaName',
						'tableName',
						'connectionHost',
						'connectionPort',
						'connectionDatabase',
						'connectionUser',
						'connectionPassword',
					],
					searchable: true,
				},
				default: [],
				required: false,
				placeholder: 'Requiere ejecución de nodos previos',
				description: 'Pick only the columns you need. Nothing is pre-selected.',
			},
		],
	};

	methods = {
		loadOptions: {
			async getColumnOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				logCollapsOperation(
					NODE_NAME,
					'getColumnOptions()',
					{ status: 'invoked' },
					'ENTRY — loadOptions hook fired.',
				);

				const logMeta = { node: NODE_NAME, context: 'getColumnOptions()' };

				try {
					const connection = resolveLoadOptionsConnection(this);
					const schema = readCurrentNodeString(this, 'schemaName');
					const tableName = readValidatedTableNameFromParameter(
						readCurrentNodeString(this, 'tableName'),
					);

					logCollapsOperation(
						NODE_NAME,
						'getColumnOptions()',
						{ schema, tableName },
						'Contexto resuelto antes de SQL.',
					);

					if (!connection || !isValidSqlIdentifier(schema) || !tableName) {
						return [];
					}

					const options = await fetchColumnPropertyOptions(
						this,
						schema,
						tableName,
						logMeta,
						connection,
					);

					logCollapsOperation(
						NODE_NAME,
						'getColumnOptions()',
						options.map((option) => option.value),
						`Columnas cargadas vía SQL live para ${schema}.${tableName}.`,
					);

					return options;
				} catch (error) {
					logCollapsOperation(
						NODE_NAME,
						'getColumnOptions()',
						{ error: error instanceof Error ? error.message : String(error) },
						'ERROR en getColumnOptions.',
					);
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
				const schema = String(input.schema ?? '').trim();
				const tableName = readValidatedTableNameFromParameter(input.tableName);

				if (!isValidSqlIdentifier(schema) || !tableName) {
					throw new NodeOperationError(
						this.getNode(),
						new Error(
							'Schema Name or Table Name is unavailable. Execute COLLAPS Table Selector first.',
						),
					);
				}

				const selectedColumns = this.getNodeParameter('columns', itemIndex, []) as string[];

				const output: ColumnSelectorOutput = {
					schema,
					tableName,
					columns: selectedColumns
						.map((column) => String(column).trim())
						.filter(Boolean),
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
