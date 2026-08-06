"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryWithCollapsLog = exports.logCollapsOperation = exports.logCollapsBlock = void 0;
exports.resolveConnectionConfig = resolveConnectionConfig;
exports.toPostgresError = toPostgresError;
exports.withPostgresConnection = withPostgresConnection;
exports.withPostgresClient = withPostgresClient;
exports.resolveSchema = resolveSchema;
exports.resolveSelectorSchema = resolveSelectorSchema;
exports.resolveSchemaFromStream = resolveSchemaFromStream;
exports.quoteIdentifier = quoteIdentifier;
const pg_1 = __importDefault(require("pg"));
const collapsLogger_1 = require("./collapsLogger");
var collapsLogger_2 = require("./collapsLogger");
Object.defineProperty(exports, "logCollapsBlock", { enumerable: true, get: function () { return collapsLogger_2.logCollapsBlock; } });
Object.defineProperty(exports, "logCollapsOperation", { enumerable: true, get: function () { return collapsLogger_2.logCollapsOperation; } });
Object.defineProperty(exports, "queryWithCollapsLog", { enumerable: true, get: function () { return collapsLogger_2.queryWithCollapsLog; } });
function buildClientConfig(credentials) {
    var _a;
    return {
        host: credentials.host,
        port: credentials.port,
        database: credentials.database,
        user: credentials.user,
        password: credentials.password,
        ssl: (_a = credentials.ssl) !== null && _a !== void 0 ? _a : { rejectUnauthorized: false },
    };
}
function resolveConnectionConfig(input = {}, overrides = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const host = String((_b = (_a = overrides.host) !== null && _a !== void 0 ? _a : input.host) !== null && _b !== void 0 ? _b : '').trim();
    const port = Number((_c = overrides.port) !== null && _c !== void 0 ? _c : input.port);
    const database = String((_e = (_d = overrides.database) !== null && _d !== void 0 ? _d : input.database) !== null && _e !== void 0 ? _e : '').trim();
    const user = String((_g = (_f = overrides.user) !== null && _f !== void 0 ? _f : input.user) !== null && _g !== void 0 ? _g : '').trim();
    const password = String((_j = (_h = overrides.password) !== null && _h !== void 0 ? _h : input.password) !== null && _j !== void 0 ? _j : '').trim();
    if (!host ||
        !database ||
        !user ||
        !password ||
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535) {
        return null;
    }
    return {
        host,
        port,
        database,
        user,
        password,
        ssl: { rejectUnauthorized: false },
    };
}
function toPostgresError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(`[PostgreSQL Error] ${message}`);
}
async function withPostgresConnection(connection, fn) {
    const client = new pg_1.default.Client(buildClientConfig(connection));
    try {
        (0, collapsLogger_1.logCollapsBlock)({
            node: 'postgresClient',
            context: 'withPostgresConnection()',
            note: `Conectando a ${connection.host}/${connection.database} como ${connection.user}`,
        });
        await client.connect();
        return await fn(client);
    }
    catch (error) {
        (0, collapsLogger_1.logCollapsBlock)({
            node: 'postgresClient',
            context: 'withPostgresConnection()',
            note: `Error al conectar o consultar: ${error instanceof Error ? error.message : String(error)}`,
        });
        throw toPostgresError(error);
    }
    finally {
        await client.end().catch(() => undefined);
    }
}
async function withPostgresClient(_context, fn, connectionOverride) {
    if (!connectionOverride) {
        throw new Error('PostgreSQL credentials are required from the connected COLLAPS Database Connection.');
    }
    return withPostgresConnection(connectionOverride, fn);
}
function resolveSchema(schema) {
    return (schema === null || schema === void 0 ? void 0 : schema.trim()) ? schema.trim() : 'public';
}
function resolveSelectorSchema(schema) {
    var _a;
    return (_a = schema === null || schema === void 0 ? void 0 : schema.trim()) !== null && _a !== void 0 ? _a : '';
}
function resolveSchemaFromStream(schemaParam, input) {
    var _a, _b;
    const fromParam = schemaParam === null || schemaParam === void 0 ? void 0 : schemaParam.trim();
    if (fromParam) {
        return fromParam;
    }
    const selectedSchema = (_a = input.selectedSchema) === null || _a === void 0 ? void 0 : _a.trim();
    if (selectedSchema) {
        return selectedSchema;
    }
    const schema = (_b = input.schema) === null || _b === void 0 ? void 0 : _b.trim();
    if (schema) {
        return schema;
    }
    return '';
}
function quoteIdentifier(identifier) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
        throw new Error(`Identificador SQL inválido: "${identifier}"`);
    }
    return `"${identifier.replace(/"/g, '""')}"`;
}
