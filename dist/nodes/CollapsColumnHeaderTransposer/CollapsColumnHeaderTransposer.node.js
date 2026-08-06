"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollapsColumnHeaderTransposer = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const collapsLogger_1 = require("../helpers/collapsLogger");
const loadOptionsConnection_1 = require("../helpers/loadOptionsConnection");
const postgresClient_1 = require("../helpers/postgresClient");
const sqlValidation_1 = require("../helpers/sqlValidation");
const NODE_NAME = 'CollapsColumnHeaderTransposer';
const COLUMNS_SQL = `
	SELECT column_name
	FROM information_schema.columns
	WHERE table_catalog = current_database()
		AND table_schema = $1
		AND table_name = $2
	ORDER BY ordinal_position
`;
function readResolvedParameter(context, name, itemIndex) {
    var _a;
    const value = String((_a = context.getNodeParameter(name, itemIndex, '')) !== null && _a !== void 0 ? _a : '').trim();
    return value.startsWith('=') || value.includes('{{') ? '' : value;
}
function resolveExecuteConnection(context, itemIndex, input) {
    var _a;
    const fromInput = (_a = (0, loadOptionsConnection_1.connectionFromInput)(input)) !== null && _a !== void 0 ? _a : (0, postgresClient_1.resolveConnectionConfig)(input);
    if (fromInput) {
        return fromInput;
    }
    return (0, postgresClient_1.resolveConnectionConfig)({}, {
        host: readResolvedParameter(context, 'connectionHost', itemIndex),
        port: Number(context.getNodeParameter('connectionPort', itemIndex, 0)),
        database: readResolvedParameter(context, 'connectionDatabase', itemIndex),
        user: readResolvedParameter(context, 'connectionUser', itemIndex),
        password: readResolvedParameter(context, 'connectionPassword', itemIndex),
    });
}
function readTableContext(input) {
    var _a, _b, _c, _d, _e;
    const schema = String((_c = (_b = (_a = input.schema) !== null && _a !== void 0 ? _a : input.schemaName) !== null && _b !== void 0 ? _b : input.selectedSchema) !== null && _c !== void 0 ? _c : '').trim();
    const tableName = String((_e = (_d = input.tableName) !== null && _d !== void 0 ? _d : input.sourceTable) !== null && _e !== void 0 ? _e : '').trim();
    if (!(0, sqlValidation_1.isValidSqlIdentifier)(schema) || !(0, sqlValidation_1.isValidSqlIdentifier)(tableName)) {
        return null;
    }
    return { schema, tableName };
}
function readFirstColumn(input) {
    var _a;
    const columns = Array.isArray(input.columns) ? input.columns : [];
    const column = String((_a = columns[0]) !== null && _a !== void 0 ? _a : '').trim();
    return (0, sqlValidation_1.isValidSqlIdentifier)(column) ? column : '';
}
async function fetchColumnNames(client, schema, tableName) {
    const result = await (0, collapsLogger_1.queryWithCollapsLog)(client, { node: NODE_NAME, context: 'fetchColumnNames()' }, COLUMNS_SQL, [schema, tableName], (rows) => rows.map((row) => row.column_name));
    return result.rows
        .map((row) => row.column_name)
        .filter((column) => (0, sqlValidation_1.isValidSqlIdentifier)(column));
}
async function fetchSampleValue(client, schema, tableName, column) {
    var _a, _b;
    const qualifiedTable = `${(0, postgresClient_1.quoteIdentifier)(schema)}.${(0, postgresClient_1.quoteIdentifier)(tableName)}`;
    const qualifiedColumn = (0, postgresClient_1.quoteIdentifier)(column);
    try {
        const result = await client.query(`SELECT ${qualifiedColumn} AS sample_value FROM ${qualifiedTable} LIMIT 1`);
        return (_b = (_a = result.rows[0]) === null || _a === void 0 ? void 0 : _a.sample_value) !== null && _b !== void 0 ? _b : null;
    }
    catch {
        return null;
    }
}
async function synchronizeStructureLog(client, sourceSchema, sourceTable, targetSchema, targetTable, targetColumn) {
    var _a;
    const sourceColumns = await fetchColumnNames(client, sourceSchema, sourceTable);
    const targetColumns = new Set(await fetchColumnNames(client, targetSchema, targetTable));
    const requiredTargetColumns = [
        'tabla',
        'columna_origen',
        targetColumn,
        'valor_ejemplo',
        'fecha_ultima_recepcion',
        'vigente',
    ];
    const missingTargetColumns = requiredTargetColumns.filter((column) => !targetColumns.has(column));
    if (missingTargetColumns.length > 0) {
        throw new Error(`Target table ${targetSchema}.${targetTable} is missing required columns: ${[...new Set(missingTargetColumns)].join(', ')}.`);
    }
    if (['tabla', 'valor_ejemplo', 'fecha_ultima_recepcion', 'vigente'].includes(targetColumn)) {
        throw new Error(`Target column "${targetColumn}" is reserved for automatic metadata.`);
    }
    const qualifiedTarget = `${(0, postgresClient_1.quoteIdentifier)(targetSchema)}.${(0, postgresClient_1.quoteIdentifier)(targetTable)}`;
    const existingResult = await client.query(`SELECT columna_origen FROM ${qualifiedTarget} WHERE tabla = $1`, [sourceTable]);
    const existingColumns = new Set(existingResult.rows.map((row) => { var _a; return String((_a = row.columna_origen) !== null && _a !== void 0 ? _a : ''); }));
    const newColumns = sourceColumns.filter((column) => !existingColumns.has(column)).length;
    const updatedColumns = sourceColumns.length - newColumns;
    const deprecatedResult = await client.query(`UPDATE ${qualifiedTarget}
		 SET vigente = FALSE
		 WHERE tabla = $1
		   AND vigente IS DISTINCT FROM FALSE
		   AND NOT (columna_origen = ANY($2::text[]))`, [sourceTable, sourceColumns]);
    for (const column of sourceColumns) {
        const sampleValue = await fetchSampleValue(client, sourceSchema, sourceTable, column);
        const insertColumns = ['tabla', 'columna_origen'];
        const valueExpressions = ['$1', '$2'];
        const values = [sourceTable, column];
        const updateAssignments = [];
        if (targetColumn !== 'columna_origen') {
            insertColumns.push(targetColumn);
            values.push(column);
            valueExpressions.push(`$${values.length}`);
            updateAssignments.push(`${(0, postgresClient_1.quoteIdentifier)(targetColumn)} = EXCLUDED.${(0, postgresClient_1.quoteIdentifier)(targetColumn)}`);
        }
        insertColumns.push('valor_ejemplo', 'fecha_ultima_recepcion', 'vigente');
        values.push(sampleValue);
        valueExpressions.push(`$${values.length}`, 'NOW()', 'TRUE');
        updateAssignments.push('valor_ejemplo = EXCLUDED.valor_ejemplo', 'fecha_ultima_recepcion = NOW()', 'vigente = TRUE');
        await client.query(`INSERT INTO ${qualifiedTarget}
				(${insertColumns.map(postgresClient_1.quoteIdentifier).join(', ')})
			 VALUES (${valueExpressions.join(', ')})
			 ON CONFLICT (tabla, columna_origen) DO UPDATE SET
				${updateAssignments.join(', ')}`, values);
    }
    return {
        status: 'success',
        source_table: sourceTable,
        target_table: targetTable,
        target_column: targetColumn,
        columns_detected: sourceColumns.length,
        new_columns: newColumns,
        updated_columns: updatedColumns,
        deprecated_columns: (_a = deprecatedResult.rowCount) !== null && _a !== void 0 ? _a : 0,
    };
}
class CollapsColumnHeaderTransposer {
    constructor() {
        this.description = {
            displayName: 'COLLAPS Column Header Transposer',
            name: 'collapsColumnHeaderTransposer',
            icon: 'fa:th-list',
            group: ['transform'],
            version: 1,
            subtitle: '3-input active transposer',
            description: 'Maps source-table headers into a selected target column and persists them directly in PostgreSQL.',
            defaults: {
                name: 'COLLAPS Column Header Transposer',
            },
            inputs: [
                { displayName: 'Source Table', type: n8n_workflow_1.NodeConnectionTypes.Main },
                { displayName: 'Target Table', type: n8n_workflow_1.NodeConnectionTypes.Main },
                { displayName: 'Target Column', type: n8n_workflow_1.NodeConnectionTypes.Main },
            ],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            properties: [
                ...(0, loadOptionsConnection_1.upstreamConnectionProperties)(),
                {
                    displayName: 'Structure Sensor',
                    name: 'structureNotice',
                    type: 'notice',
                    default: '',
                    description: 'Conecte Source Table, Target Table y Target Column. El nodo detectará los headers y los escribirá directamente.',
                },
            ],
        };
    }
    async execute() {
        var _a, _b, _c;
        const itemIndex = 0;
        try {
            const sourceInput = (_a = this.getInputData(0)[0]) === null || _a === void 0 ? void 0 : _a.json;
            const targetInput = (_b = this.getInputData(1)[0]) === null || _b === void 0 ? void 0 : _b.json;
            const columnInput = (_c = this.getInputData(2)[0]) === null || _c === void 0 ? void 0 : _c.json;
            const source = sourceInput ? readTableContext(sourceInput) : null;
            const target = targetInput ? readTableContext(targetInput) : null;
            const columnTable = columnInput ? readTableContext(columnInput) : null;
            const targetColumn = columnInput ? readFirstColumn(columnInput) : '';
            if (!source || !target || !columnTable || !targetColumn) {
                throw new Error('Falta configuración de Origen, Destino o Columna');
            }
            if (columnTable.schema !== target.schema ||
                columnTable.tableName !== target.tableName) {
                throw new Error('La Columna Destino debe provenir de la misma Tabla Destino.');
            }
            const connection = resolveExecuteConnection(this, itemIndex, sourceInput !== null && sourceInput !== void 0 ? sourceInput : {});
            if (!connection) {
                throw new Error('No se recibieron credenciales válidas desde COLLAPS Database Connection.');
            }
            const summary = await (0, postgresClient_1.withPostgresConnection)(connection, async (client) => {
                await client.query('BEGIN');
                try {
                    const result = await synchronizeStructureLog(client, source.schema, source.tableName, target.schema, target.tableName, targetColumn);
                    await client.query('COMMIT');
                    return result;
                }
                catch (error) {
                    await client.query('ROLLBACK');
                    throw error;
                }
            });
            (0, collapsLogger_1.logCollapsOperation)(NODE_NAME, 'execute()', summary, `Headers synchronized from ${source.schema}.${source.tableName} into ${target.schema}.${target.tableName}.${targetColumn}.`);
            return [
                [
                    {
                        json: summary,
                        pairedItem: { item: itemIndex },
                    },
                ],
            ];
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex });
        }
    }
}
exports.CollapsColumnHeaderTransposer = CollapsColumnHeaderTransposer;
