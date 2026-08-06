import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ResourceMapperFields,
	ResourceMapperValue,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { resolveMapperResourceMapperFields } from '../helpers/mapperResourceMapper';
import { logCollapsOperation } from '../helpers/collapsLogger';
import {
	firstColumn,
	pairByIndex,
	toColumnsArray,
	toPairOutput,
} from '../helpers/transformerPairing';

interface BttfMapperPayload {
	source: 'n8n';
	analysis_id: string;
	schema_name: string;
	tabla_a: string;
	tabla_b: string;
	llave_cruce_a: string;
	llave_cruce_b: string;
	columnas_a: string;
	columnas_b: string;
}

function readInputBranch(
	context: IExecuteFunctions,
	inputIndex: number,
	label: string,
): IDataObject {
	const items = context.getInputData(inputIndex);
	const json = items[0]?.json;

	if (!json) {
		throw new Error(`Input "${label}" (input ${inputIndex}) is empty.`);
	}

	return json;
}

function buildKeyPairLabel(keyA: string, keyB: string): string {
	return `${keyA} / ${keyB}`;
}

function pairsFromResourceMapper(
	columnMapping: ResourceMapperValue,
): Array<{ pair_label: string; column_a: string; column_b: string }> {
	const value = columnMapping?.value;
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return [];
	}

	return Object.entries(value)
		.map(([columnA, columnB], index) => {
			const column_a = String(columnA).trim();
			const column_b = String(columnB ?? '').trim();
			if (!column_a || !column_b) {
				return null;
			}

			return toPairOutput(column_a, column_b, index);
		})
		.filter((pair): pair is NonNullable<typeof pair> => pair !== null);
}

export class CollapsKeyColumnMapper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'COLLAPS Key & Column Mapper',
		name: 'collapsKeyColumnMapper',
		icon: 'fa:table',
		group: ['transform'],
		version: 1,
		subtitle: 'Key & Column Mapper',
		description: 'Maps keys and column pairs between Source A and Source B',
		defaults: {
			name: 'COLLAPS Key & Column Mapper',
		},
		inputs: [
			{ displayName: 'Key A', type: NodeConnectionTypes.Main },
			{ displayName: 'Columns A', type: NodeConnectionTypes.Main },
			{ displayName: 'Key B', type: NodeConnectionTypes.Main },
			{ displayName: 'Columns B', type: NodeConnectionTypes.Main },
		],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Automated Discovery',
				name: 'discoveryNotice',
				type: 'notice',
				default: '',
				description:
					'Table names and columns are resolved from the connected Key A / Columns A and Key B / Columns B inputs (Column Selector output). Analysis Name and Target Table are configured on COLLAPS BTTF Trigger.',
			},
			{
				displayName: 'Upstream Columns A CSV',
				name: 'upstreamColumnsA_csv',
				type: 'hidden',
				default: '={{ $input.all(1)[0]?.json?.columns?.join(",") || "" }}',
			},
			{
				displayName: 'Upstream Columns B CSV',
				name: 'upstreamColumnsB_csv',
				type: 'hidden',
				default: '={{ $input.all(3)[0]?.json?.columns?.join(",") || "" }}',
			},
			{
				displayName: 'Column Mapping',
				name: 'columnMapping',
				type: 'resourceMapper',
				noDataExpression: true,
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				typeOptions: {
					loadOptionsDependsOn: ['upstreamColumnsA_csv', 'upstreamColumnsB_csv'],
					resourceMapper: {
						resourceMapperMethod: 'getMappingColumns',
						mode: 'map',
						fieldWords: {
							singular: 'column',
							plural: 'columns',
						},
						addAllFields: true,
						supportAutoMap: true,
					},
				},
				description:
					'Map columns from Table A to Table B. Leave empty to auto-pair by index at execution time.',
			},
		],
	};

	methods = {
		resourceMapping: {
			async getMappingColumns(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				logCollapsOperation(
					'CollapsKeyColumnMapper',
					'getMappingColumns()',
					{ phase: 'START' },
					'Invocado desde resourceMapperMethod.',
				);

				try {
					const { result, debug } = resolveMapperResourceMapperFields(this);

					if (!Array.isArray(result.fields) || result.fields.length === 0) {
						logCollapsOperation(
							'CollapsKeyColumnMapper',
							'getMappingColumns()',
							debug,
							'Sin columnas — retornando { fields: [] }.',
						);
						return { fields: [] };
					}

					logCollapsOperation(
						'CollapsKeyColumnMapper',
						'getMappingColumns()',
						{
							fieldsCount: result.fields.length,
							fieldIds: result.fields.map((field) => field.id),
						},
						'Retornando { fields: [...] } al resourceMapper.',
					);

					return result;
				} catch (error) {
					logCollapsOperation(
						'CollapsKeyColumnMapper',
						'getMappingColumns()',
						{ error: error instanceof Error ? error.message : String(error) },
						'ERROR — retornando { fields: [] }.',
					);
					console.error('[KeyColumnMapper] getMappingColumns error:', error);
					return { fields: [] };
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const returnData: INodeExecutionData[] = [];

		try {
			const itemIndex = 0;
			const columnMapping = this.getNodeParameter('columnMapping', itemIndex) as ResourceMapperValue;

			const keyA = readInputBranch(this, 0, 'Key A');
			const colsA = readInputBranch(this, 1, 'Columns A');
			const keyB = readInputBranch(this, 2, 'Key B');
			const colsB = readInputBranch(this, 3, 'Columns B');

			const schemaName = String(
				keyA.schema ?? colsA.schema ?? keyB.schema ?? colsB.schema ?? '',
			).trim();
			const llaveCruceA = firstColumn(keyA.columns);
			const llaveCruceB = firstColumn(keyB.columns);
			const columnsA = toColumnsArray(colsA.columns);
			const columnsB = toColumnsArray(colsB.columns);

			if (!schemaName) {
				throw new Error('Schema is required from the connected Column Selector inputs.');
			}

			if (!llaveCruceA || !llaveCruceB) {
				throw new Error('Key A and Key B must include at least one column in columns[].');
			}

			if (columnsA.length === 0 || columnsB.length === 0) {
				throw new Error('Columns A and Columns B cannot be empty.');
			}

			const mappedPairs = pairsFromResourceMapper(columnMapping);

			let pairs: Array<{ pair_label: string; column_a: string; column_b: string }>;
			let pairing_mode: 'manual' | 'auto';

			if (mappedPairs.length > 0) {
				pairs = mappedPairs;
				pairing_mode = 'manual';
			} else {
				pairs = pairByIndex(columnsA, columnsB).map((pair) =>
					toPairOutput(pair.column_a, pair.column_b, pair.index),
				);
				pairing_mode = 'auto';
			}

			if (pairs.length === 0) {
				throw new Error('Could not build any column pairs.');
			}

			const bttfPayload: BttfMapperPayload = {
				source: 'n8n',
				analysis_id: `n8n_${Date.now()}`,
				schema_name: schemaName,
				tabla_a: String(colsA.tableName ?? keyA.tableName ?? ''),
				tabla_b: String(colsB.tableName ?? keyB.tableName ?? ''),
				llave_cruce_a: llaveCruceA,
				llave_cruce_b: llaveCruceB,
				columnas_a: pairs.map((pair) => pair.column_a).join(','),
				columnas_b: pairs.map((pair) => pair.column_b).join(','),
			};

			const emittedPayload = {
				bttfPayload,
				key_pair_label: buildKeyPairLabel(llaveCruceA, llaveCruceB),
				column_pairs: pairs,
				pairing_mode,
			};

			logCollapsOperation('CollapsKeyColumnMapper', 'execute()', emittedPayload);

			returnData.push({
				json: emittedPayload,
			});
		} catch (error) {
			throw new NodeOperationError(this.getNode(), error as Error);
		}

		return [returnData];
	}
}
