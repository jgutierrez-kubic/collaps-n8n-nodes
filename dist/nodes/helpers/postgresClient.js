"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_POSTGRES_CREDENTIALS = exports.DEFAULT_SELECTOR_SCHEMA = exports.CLOUDSQL_PUBLIC_HOST = exports.queryWithCollapsLog = exports.logCollapsOperation = exports.logCollapsBlock = void 0;
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
exports.CLOUDSQL_PUBLIC_HOST = '136.116.101.31';
exports.DEFAULT_SELECTOR_SCHEMA = 's00001_incancer';
exports.DEFAULT_POSTGRES_CREDENTIALS = {
    host: exports.CLOUDSQL_PUBLIC_HOST,
    port: 5432,
    user: 'n8n_user',
    password: 'COLLAPS_n8n_2026!',
    database: 'collaps',
    ssl: { rejectUnauthorized: false },
};
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    return {
        host: String((_b = (_a = overrides.host) !== null && _a !== void 0 ? _a : input.host) !== null && _b !== void 0 ? _b : exports.DEFAULT_POSTGRES_CREDENTIALS.host),
        port: Number((_d = (_c = overrides.port) !== null && _c !== void 0 ? _c : input.port) !== null && _d !== void 0 ? _d : exports.DEFAULT_POSTGRES_CREDENTIALS.port),
        database: String((_f = (_e = overrides.database) !== null && _e !== void 0 ? _e : input.database) !== null && _f !== void 0 ? _f : exports.DEFAULT_POSTGRES_CREDENTIALS.database),
        user: String((_h = (_g = overrides.user) !== null && _g !== void 0 ? _g : input.user) !== null && _h !== void 0 ? _h : exports.DEFAULT_POSTGRES_CREDENTIALS.user),
        password: String((_k = (_j = overrides.password) !== null && _j !== void 0 ? _j : input.password) !== null && _k !== void 0 ? _k : exports.DEFAULT_POSTGRES_CREDENTIALS.password),
        ssl: { rejectUnauthorized: false },
    };
}
async function resolveCredentials(context) {
    var _a;
    try {
        const credentials = await context.getCredentials('postgres');
        if (credentials === null || credentials === void 0 ? void 0 : credentials.host) {
            return {
                host: credentials.host,
                port: (_a = credentials.port) !== null && _a !== void 0 ? _a : 5432,
                database: credentials.database,
                user: credentials.user,
                password: credentials.password,
                ssl: { rejectUnauthorized: false },
            };
        }
    }
    catch {
        // Zero-Form: usar IP pública COLLAPS por defecto
    }
    return null;
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
async function withPostgresClient(context, fn, connectionOverride) {
    var _a;
    const credentials = (_a = connectionOverride !== null && connectionOverride !== void 0 ? connectionOverride : (await resolveCredentials(context))) !== null && _a !== void 0 ? _a : exports.DEFAULT_POSTGRES_CREDENTIALS;
    return withPostgresConnection(credentials, fn);
}
function resolveSchema(schema) {
    return (schema === null || schema === void 0 ? void 0 : schema.trim()) ? schema.trim() : 'public';
}
function resolveSelectorSchema(schema) {
    return (schema === null || schema === void 0 ? void 0 : schema.trim()) ? schema.trim() : exports.DEFAULT_SELECTOR_SCHEMA;
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
    return exports.DEFAULT_SELECTOR_SCHEMA;
}
function quoteIdentifier(identifier) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
        throw new Error(`Identificador SQL inválido: "${identifier}"`);
    }
    return `"${identifier.replace(/"/g, '""')}"`;
}
