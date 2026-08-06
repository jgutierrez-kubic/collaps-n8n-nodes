"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLoadOptionsConnection = resolveLoadOptionsConnection;
exports.upstreamConnectionProperties = upstreamConnectionProperties;
exports.connectionFromInput = connectionFromInput;
const DATABASE_CONNECTION_NODE = 'COLLAPS Database Connection';
function readCurrentParameter(context, name) {
    try {
        return context.getNodeParameter(name, '');
    }
    catch {
        try {
            return context.getCurrentNodeParameter(name);
        }
        catch {
            return undefined;
        }
    }
}
function readResolvedString(context, name) {
    var _a;
    const value = String((_a = readCurrentParameter(context, name)) !== null && _a !== void 0 ? _a : '').trim();
    return value.startsWith('=') || value.includes('{{') ? '' : value;
}
function resolveLoadOptionsConnection(context) {
    const host = readResolvedString(context, 'connectionHost');
    const database = readResolvedString(context, 'connectionDatabase');
    const user = readResolvedString(context, 'connectionUser');
    const password = readResolvedString(context, 'connectionPassword');
    const port = Number(readCurrentParameter(context, 'connectionPort'));
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
function upstreamConnectionProperties() {
    const expression = (field) => `={{ $node["${DATABASE_CONNECTION_NODE}"].parameter["${field}"] }}`;
    return [
        {
            displayName: 'Connection Host',
            name: 'connectionHost',
            type: 'hidden',
            default: expression('host'),
        },
        {
            displayName: 'Connection Port',
            name: 'connectionPort',
            type: 'hidden',
            default: expression('port'),
        },
        {
            displayName: 'Connection Database',
            name: 'connectionDatabase',
            type: 'hidden',
            default: expression('database'),
        },
        {
            displayName: 'Connection User',
            name: 'connectionUser',
            type: 'hidden',
            default: expression('user'),
        },
        {
            displayName: 'Connection Password',
            name: 'connectionPassword',
            type: 'hidden',
            default: expression('password'),
        },
    ];
}
function connectionFromInput(input) {
    var _a, _b, _c, _d;
    const port = Number(input.port);
    const host = String((_a = input.host) !== null && _a !== void 0 ? _a : '').trim();
    const database = String((_b = input.database) !== null && _b !== void 0 ? _b : '').trim();
    const user = String((_c = input.user) !== null && _c !== void 0 ? _c : '').trim();
    const password = String((_d = input.password) !== null && _d !== void 0 ? _d : '').trim();
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
