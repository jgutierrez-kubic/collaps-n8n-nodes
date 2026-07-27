import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { logCollapsOperation } from '../helpers/collapsLogger';

const NODE_NAME = 'CollapsBttfTrigger';
const ENGINE_URL = 'https://bttf-engine-31997537275.us-central1.run.app/api/v1/condenser/job';

function readRequiredBttfPayload(structureItem: IDataObject | undefined): IDataObject {
	const nested = structureItem?.bttfPayload;
	if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
		return { ...(nested as IDataObject) };
	}

	throw new Error(
		'No bttfPayload found on Input 0 (Structure & Data). Connect COLLAPS Key & Column Mapper.',
	);
}

function readRequiredMetodosCalculo(methodsItem: IDataObject | undefined): string {
	const value = methodsItem?.metodos_calculo;
	if (value !== undefined && value !== null && String(value).trim()) {
		return String(value).trim();
	}

	const nested = methodsItem?.bttfPayload;
	if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
		const fromNested = (nested as IDataObject).metodos_calculo;
		if (fromNested !== undefined && fromNested !== null && String(fromNested).trim()) {
			return String(fromNested).trim();
		}
	}

	throw new Error(
		'No metodos_calculo found on Input 1 (Calculation Methods). Connect COLLAPS Method Configurator.',
	);
}

function resolveTablaDestino(schemaName: unknown, targetTable: string): string {
	const table = targetTable.trim();
	if (!table) {
		return '';
	}

	if (table.includes('.')) {
		return table;
	}

	const schema = String(schemaName ?? '').trim();
	return schema ? `${schema}.${table}` : table;
}

export class CollapsBttfTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'COLLAPS BTTF Trigger',
		name: 'collapsBttfTrigger',
		icon: 'fa:bolt',
		group: ['transform'],
		version: 1,
		subtitle: 'BTTF Condenser Job',
		description:
			'Merges structure (Input 0) with methods (Input 1) and POSTs the job to the COLLAPS BTTF Engine on Cloud Run. Persistence is handled by the engine.',
		defaults: {
			name: 'COLLAPS BTTF Trigger',
		},
		inputs: [
			{ displayName: 'Structure & Data', type: NodeConnectionTypes.Main },
			{ displayName: 'Calculation Methods', type: NodeConnectionTypes.Main },
		],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Analysis Name',
				name: 'analysisName',
				type: 'string',
				default: 'My Analysis',
				required: true,
				description: 'Human-readable analysis name sent as nombre_analisis.',
			},
			{
				displayName: 'Target Table',
				name: 'targetTable',
				type: 'string',
				default: 'c_resultados',
				required: true,
				description:
					'Destination table for engine results (tabla_destino). Schema is prepended from the Mapper payload when omitted.',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const structureItems = this.getInputData(0);
		const methodsItems = this.getInputData(1);
		const returnData: INodeExecutionData[] = [];

		if (structureItems.length === 0) {
			throw new NodeOperationError(
				this.getNode(),
				new Error(
					'Input 0 (Structure & Data) is empty. Connect COLLAPS Key & Column Mapper.',
				),
			);
		}

		if (methodsItems.length === 0) {
			throw new NodeOperationError(
				this.getNode(),
				new Error(
					'Input 1 (Calculation Methods) is empty. Connect COLLAPS Method Configurator.',
				),
			);
		}

		const itemCount = Math.max(structureItems.length, methodsItems.length);

		for (let itemIndex = 0; itemIndex < itemCount; itemIndex++) {
			try {
				const structureInput =
					structureItems[itemIndex]?.json ?? structureItems[0]?.json ?? {};
				const methodsInput = methodsItems[itemIndex]?.json ?? methodsItems[0]?.json ?? {};

				const basePayload = readRequiredBttfPayload(structureInput);
				const metodosCalculo = readRequiredMetodosCalculo(methodsInput);
				const analysisName = String(
					this.getNodeParameter('analysisName', itemIndex, 'My Analysis') ?? 'My Analysis',
				).trim();
				const targetTable = String(
					this.getNodeParameter('targetTable', itemIndex, 'c_resultados') ?? 'c_resultados',
				).trim();

				if (!analysisName) {
					throw new Error('Analysis Name (analysisName) is required.');
				}

				if (!targetTable) {
					throw new Error('Target Table (targetTable) is required.');
				}

				let resolvedCallbackUrl = '';
				try {
					resolvedCallbackUrl = this.evaluateExpression(
						'{{ $execution.resumeUrl }}',
						0,
					) as string;
					resolvedCallbackUrl = String(resolvedCallbackUrl ?? '')
						.replace(/^=/, '')
						.trim();
				} catch {
					// If evaluation fails or Wait/resume is not available, leave empty.
				}
				resolvedCallbackUrl = String(resolvedCallbackUrl ?? '').trim();

				const payloadToSend: IDataObject = {
					...basePayload,
					metodos_calculo: metodosCalculo,
					nombre_analisis: analysisName,
					tabla_destino: resolveTablaDestino(basePayload.schema_name, targetTable),
				};

				if (resolvedCallbackUrl) {
					payloadToSend.callback_url = resolvedCallbackUrl;
				}

				logCollapsOperation(
					NODE_NAME,
					'execute()',
					{ phase: 'merged_payload', payloadToSend },
					'Payload consolidado Input0+Input1 + UI (analysisName/targetTable).',
				);

				const apiResponse = (await this.helpers.request({
					method: 'POST',
					uri: ENGINE_URL,
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
					'Job aceptado por BTTF Engine (HTTP 202 esperado).',
				);

				returnData.push(
					...this.helpers.returnJsonArray({
						request: payloadToSend,
						response: apiResponse,
					}),
				);
			} catch (error) {
				throw new NodeOperationError(this.getNode(), error as Error);
			}
		}

		return [returnData];
	}
}
