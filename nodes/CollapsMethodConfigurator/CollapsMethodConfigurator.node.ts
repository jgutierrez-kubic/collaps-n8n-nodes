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
	BTTF_METHOD_OPTIONS,
	DEFAULT_BTTF_METHOD,
	PER_PAIR_FALLBACK_METHOD,
	type BttfMethodId,
} from '../helpers/bttfMethods';
import { logCollapsOperation } from '../helpers/collapsLogger';
import { readCurrentNodeSelectedPairKeys } from '../helpers/mapperPairLabels';
import { parseColumnPairsFromInput, type ColumnPair } from '../helpers/transformerPairing';

const NODE_NAME = 'CollapsMethodConfigurator';

type AssignmentMode = 'global' | 'perPair';

interface PairMethodAssignment {
	pairKey?: string;
	method: BttfMethodId;
}

function extractMapperInput(input: IDataObject): {
	bttfPayload: IDataObject;
	columnPairs: ColumnPair[];
} {
	if (!input.bttfPayload || typeof input.bttfPayload !== 'object' || Array.isArray(input.bttfPayload)) {
		throw new Error(
			'No bttfPayload found in input. Connect the output of COLLAPS Key & Column Mapper.',
		);
	}

	const columnPairs = parseColumnPairsFromInput(input);

	if (columnPairs.length === 0) {
		throw new Error('No column pairs detected from Key & Column Mapper input.');
	}

	return {
		bttfPayload: input.bttfPayload as IDataObject,
		columnPairs,
	};
}

type MethodSource = 'global' | 'user' | 'fallback_strict_equal';

interface ResolvedPairMethod {
	method: BttfMethodId;
	method_source: MethodSource;
}

function resolveMethodsForPairs(
	assignmentMode: AssignmentMode,
	columnPairs: ColumnPair[],
	globalMethod: BttfMethodId,
	pairAssignments: PairMethodAssignment[],
): ResolvedPairMethod[] {
	if (assignmentMode === 'global') {
		return columnPairs.map(() => ({
			method: globalMethod,
			method_source: 'global',
		}));
	}

	const methodByLabel = new Map<string, BttfMethodId>();

	for (const assignment of pairAssignments) {
		const pairKey = String(assignment.pairKey ?? '').trim();
		if (!pairKey) {
			continue;
		}

		const matchingPair = columnPairs.find((pair) => pair.pair_label === pairKey);
		if (matchingPair) {
			methodByLabel.set(matchingPair.pair_label, assignment.method);
		}
	}

	return columnPairs.map((pair) => {
		const assigned = methodByLabel.get(pair.pair_label);
		if (assigned) {
			return {
				method: assigned,
				method_source: 'user',
			};
		}

		return {
			method: PER_PAIR_FALLBACK_METHOD,
			method_source: 'fallback_strict_equal',
		};
	});
}

function mergePairOptions(
	baseOptions: INodePropertyOptions[],
	selectedKeys: string[],
): INodePropertyOptions[] {
	const merged = new Map<string, INodePropertyOptions>();

	for (const option of baseOptions) {
		const value = String(option.value).trim();
		if (!value) {
			continue;
		}
		merged.set(value, { name: String(option.name), value });
	}

	for (const key of selectedKeys) {
		if (key && !merged.has(key)) {
			merged.set(key, { name: key, value: key });
		}
	}

	return Array.from(merged.values());
}

function readUpstreamColumnPairsParameter(context: ILoadOptionsFunctions): unknown {
	try {
		return context.getCurrentNodeParameter('upstreamColumnPairs');
	} catch {
		return '[]';
	}
}

function parseUpstreamColumnPairs(raw: unknown): Array<{ pair_label?: string }> {
	if (Array.isArray(raw)) {
		return raw as Array<{ pair_label?: string }>;
	}

	const pairsStr = String(raw ?? '').trim();
	if (!pairsStr || pairsStr.startsWith('={{')) {
		return [];
	}

	try {
		const parsed = JSON.parse(pairsStr) as unknown;
		return Array.isArray(parsed) ? (parsed as Array<{ pair_label?: string }>) : [];
	} catch {
		return [];
	}
}

export class CollapsMethodConfigurator implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'COLLAPS Method Configurator',
		name: 'collapsMethodConfigurator',
		icon: 'fa:sliders',
		group: ['transform'],
		version: 1,
		subtitle: 'Method Configurator',
		description:
			'Assigns metodos_calculo per pair using human-readable labels from Key & Column Mapper (e.g. NAME / NAME).',
		defaults: {
			name: 'COLLAPS Method Configurator',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Upstream Column Pairs',
				name: 'upstreamColumnPairs',
				type: 'hidden',
				default: '={{ JSON.stringify($json.column_pairs || []) }}',
			},
			{
				displayName: 'Assignment Mode',
				name: 'assignmentMode',
				type: 'options',
				options: [
					{ name: 'Global', value: 'global' },
					{ name: 'Per Pair', value: 'perPair' },
				],
				default: 'global',
				required: true,
			},
			{
				displayName: 'Global Method',
				name: 'globalMethod',
				type: 'options',
				options: BTTF_METHOD_OPTIONS,
				default: DEFAULT_BTTF_METHOD,
				required: true,
				displayOptions: {
					show: {
						assignmentMode: ['global'],
					},
				},
			},
			{
				displayName: 'Pair Methods',
				name: 'pairMethodAssignments',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				displayOptions: {
					show: {
						assignmentMode: ['perPair'],
					},
				},
				description:
					'Select each pair by its human-readable label (e.g. NAME / NAME) and assign a BTTF method.',
				options: [
					{
						displayName: 'Assignment',
						name: 'pairs',
						values: [
							{
								displayName: 'Pair',
								name: 'pairKey',
								type: 'options',
								typeOptions: {
									loadOptionsMethod: 'getPairOptions',
									loadOptionsDependsOn: ['upstreamColumnPairs'],
								},
								default: '',
								description: 'Human-readable pair label (e.g. NAME / NAME).',
							},
							{
								displayName: 'Method',
								name: 'method',
								type: 'options',
								options: BTTF_METHOD_OPTIONS,
								default: DEFAULT_BTTF_METHOD,
							},
						],
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getPairOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				logCollapsOperation(
					NODE_NAME,
					'getPairOptions()',
					{ status: 'ENTRY', node: this.getNode().name },
					'Hook loadOptions iniciado (expression bypass).',
				);

				try {
					const pairsRaw = readUpstreamColumnPairsParameter(this);
					const pairs = parseUpstreamColumnPairs(pairsRaw);

					const options: INodePropertyOptions[] = [];
					for (const pair of pairs) {
						const pairLabel = String(pair?.pair_label ?? '').trim();
						if (!pairLabel) {
							continue;
						}
						options.push({
							name: pairLabel,
							value: pairLabel,
						});
					}

					const merged = mergePairOptions(options, readCurrentNodeSelectedPairKeys(this));

					logCollapsOperation(
						NODE_NAME,
						'getPairOptions()',
						{
							rawType: typeof pairsRaw,
							pairsCount: pairs.length,
							optionsCount: merged.length,
							options: merged.map((option) => option.value),
						},
						'Opciones de Pair resueltas desde upstreamColumnPairs.',
					);

					return merged;
				} catch (error) {
					logCollapsOperation(
						NODE_NAME,
						'getPairOptions()',
						{ error: error instanceof Error ? error.message : String(error) },
						'ERROR — retornando [].',
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
				const { bttfPayload, columnPairs } = extractMapperInput(input);

				const assignmentMode = this.getNodeParameter('assignmentMode', itemIndex) as AssignmentMode;
				const globalMethod = this.getNodeParameter(
					'globalMethod',
					itemIndex,
					DEFAULT_BTTF_METHOD,
				) as BttfMethodId;

				const pairAssignmentsRaw = this.getNodeParameter(
					'pairMethodAssignments',
					itemIndex,
					{},
				) as { pairs?: PairMethodAssignment[] };
				const pairAssignments = pairAssignmentsRaw.pairs ?? [];

				const resolvedMethods = resolveMethodsForPairs(
					assignmentMode,
					columnPairs,
					globalMethod,
					pairAssignments,
				);

				const metodosCalculo = resolvedMethods.map((entry) => entry.method).join(',');
				const methodPairs = columnPairs.map((pair, index) => ({
					index: pair.index,
					pair_label: pair.pair_label,
					column_a: pair.column_a,
					column_b: pair.column_b,
					method: resolvedMethods[index].method,
					method_source: resolvedMethods[index].method_source,
				}));

				const columnasA = String(bttfPayload.columnas_a ?? '');
				const columnasAArray = columnasA.split(',').map((token) => token.trim()).filter(Boolean);
				const metodosArray = metodosCalculo.split(',').map((token) => token.trim()).filter(Boolean);

				if (columnasAArray.length !== metodosArray.length) {
					throw new NodeOperationError(
						this.getNode(),
						`Desajuste de contrato: Hay ${columnasAArray.length} columnas pero se generaron ${metodosArray.length} métodos.`,
					);
				}

				const enrichedPayload: IDataObject = {
					...bttfPayload,
					metodos_calculo: metodosCalculo,
				};

				const emittedPayload = {
					bttfPayload: enrichedPayload,
					metodos_calculo: metodosCalculo,
					method_pairs: methodPairs,
					column_pairs: columnPairs,
					assignment_mode: assignmentMode,
					pairing_warning: input.pairing_warning,
					key_pair_label: input.key_pair_label,
					pairing_mode: input.pairing_mode,
				};

				logCollapsOperation(NODE_NAME, 'execute()', emittedPayload);

				returnData.push({
					json: emittedPayload,
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				throw new NodeOperationError(this.getNode(), error as Error);
			}
		}

		return [returnData];
	}
}
