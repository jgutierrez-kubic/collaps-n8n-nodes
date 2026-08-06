import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { logCollapsOperation } from '../helpers/collapsLogger';
import { isValidSqlIdentifier } from '../helpers/sqlValidation';
import { buildWorkTableName } from '../helpers/tableNameFormatter';

const NODE_NAME = 'CollapsWorkTableGenerator';
const WORKTABLES_URL =
	'https://bttf-engine-31997537275.us-central1.run.app/api/v1/worktables/create';

type SourceSide = 'A' | 'B';
type OrderDirection = 'ASC' | 'DESC';

interface OrderByRule {
	column?: string;
	direction?: OrderDirection;
}

function readStructurePayload(input: IDataObject): IDataObject {
	const nested = input.bttfPayload;
	if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
		return nested as IDataObject;
	}

	const request = input.request;
	if (request && typeof request === 'object' && !Array.isArray(request)) {
		return request as IDataObject;
	}

	return input;
}

function readPayloadString(
	payload: IDataObject,
	camelCaseKey: string,
	legacyKey: string,
): string {
	return String(payload[camelCaseKey] ?? payload[legacyKey] ?? '').trim();
}

function parseColumnList(value: unknown): string[] {
	const values = Array.isArray(value) ? value : String(value ?? '').split(',');

	return values
		.map((column) => String(column).trim())
		.filter(Boolean)
		.map((column) => {
			if (!isValidSqlIdentifier(column)) {
				throw new Error(`Invalid Group By column: "${column}"`);
			}
			return column;
		});
}

function resolveCallbackUrl(context: IExecuteFunctions): string {
	try {
		const value = context.evaluateExpression('{{ $execution.resumeUrl }}', 0);
		return String(value ?? '').replace(/^=/, '').trim();
	} catch {
		return '';
	}
}

export class CollapsWorkTableGenerator implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'COLLAPS Work Table Generator',
		name: 'collapsWorkTableGenerator',
		icon: 'fa:table',
		group: ['transform'],
		version: 1,
		subtitle: 'Create Derived Work Table',
		description:
			'Builds a camelCase work-table request and delegates physical table creation to the COLLAPS Python backend.',
		defaults: {
			name: 'COLLAPS Work Table Generator',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Source Table',
				name: 'sourceSide',
				type: 'options',
				default: 'A',
				required: true,
				options: [
					{ name: 'Data A', value: 'A' },
					{ name: 'Data B', value: 'B' },
				],
				description: 'Whether sourceTable is resolved from tableA or tableB.',
			},
			{
				displayName: 'Work Table Name',
				name: 'workTableName',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'e.g. Monthly Fruit Summary',
				description:
					'Friendly name converted automatically to targetTable using the w_table_ prefix.',
			},
			{
				displayName: 'Group By Columns',
				name: 'groupByColumns',
				type: 'string',
				default: '',
				required: false,
				placeholder: 'e.g. category,region',
				description: 'Comma-separated column names.',
			},
			{
				displayName: 'Order By Rules',
				name: 'orderByRules',
				type: 'fixedCollection',
				default: {},
				typeOptions: {
					multipleValues: true,
					sortable: true,
				},
				options: [
					{
						displayName: 'Rule',
						name: 'rules',
						values: [
							{
								displayName: 'Column',
								name: 'column',
								type: 'string',
								default: '',
								required: true,
							},
							{
								displayName: 'Direction',
								name: 'direction',
								type: 'options',
								default: 'ASC',
								options: [
									{ name: 'Ascending', value: 'ASC' },
									{ name: 'Descending', value: 'DESC' },
								],
							},
						],
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const input = items[itemIndex]?.json ?? {};
				const structurePayload = readStructurePayload(input);
				const sourceSide = this.getNodeParameter(
					'sourceSide',
					itemIndex,
					'A',
				) as SourceSide;
				const friendlyName = String(
					this.getNodeParameter('workTableName', itemIndex, ''),
				).trim();
				const groupByColumns = parseColumnList(
					this.getNodeParameter('groupByColumns', itemIndex, ''),
				).join(', ');
				const orderByParameter = this.getNodeParameter(
					'orderByRules',
					itemIndex,
					{},
				) as { rules?: OrderByRule[] };

				if (!friendlyName) {
					throw new Error('Work Table Name is required.');
				}

				const schemaName = readPayloadString(
					structurePayload,
					'schemaName',
					'schema_name',
				);
				const sourceTable =
					sourceSide === 'A'
						? readPayloadString(structurePayload, 'tableA', 'tabla_a')
						: readPayloadString(structurePayload, 'tableB', 'tabla_b');

				if (!schemaName) {
					throw new Error('No schemaName found in the input payload.');
				}
				if (!sourceTable) {
					throw new Error(`No source table found for side ${sourceSide}.`);
				}

				const orderByRules = (orderByParameter.rules ?? [])
					.map((rule) => {
						const column = String(rule.column ?? '').trim();
						if (!isValidSqlIdentifier(column)) {
							throw new Error(`Invalid Order By column: "${column}"`);
						}

						const direction: OrderDirection =
							rule.direction === 'DESC' ? 'DESC' : 'ASC';
						return `${column} ${direction}`;
					})
					.join(', ');

				const payloadToSend: IDataObject = {
					schemaName,
					sourceTable,
					targetTable: buildWorkTableName(friendlyName),
					groupByColumns,
					orderByRules,
					callbackUrl: resolveCallbackUrl(this),
				};

				const apiResponse = (await this.helpers.request({
					method: 'POST',
					uri: WORKTABLES_URL,
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
					},
					body: payloadToSend,
					json: true,
				})) as IDataObject;

				const output = {
					request: payloadToSend,
					response: apiResponse,
				};

				logCollapsOperation(
					NODE_NAME,
					'execute()',
					output,
					'Work-table request sent using the strict camelCase API contract.',
				);

				returnData.push({
					json: output,
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				throw new NodeOperationError(this.getNode(), error as Error, {
					itemIndex,
				});
			}
		}

		return [returnData];
	}
}
