import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeProperties,
} from 'n8n-workflow';

import type { PostgresCredentials } from './postgresClient';

const DATABASE_CONNECTION_NODE = 'COLLAPS Database Connection';

function readCurrentParameter(
	context: ILoadOptionsFunctions,
	name: string,
): unknown {
	try {
		return context.getNodeParameter(name, '');
	} catch {
		try {
			return context.getCurrentNodeParameter(name);
		} catch {
			return undefined;
		}
	}
}

function readResolvedString(
	context: ILoadOptionsFunctions,
	name: string,
): string {
	const value = String(readCurrentParameter(context, name) ?? '').trim();
	return value.startsWith('=') || value.includes('{{') ? '' : value;
}

export function resolveLoadOptionsConnection(
	context: ILoadOptionsFunctions,
): PostgresCredentials | null {
	const host = readResolvedString(context, 'connectionHost');
	const database = readResolvedString(context, 'connectionDatabase');
	const user = readResolvedString(context, 'connectionUser');
	const password = readResolvedString(context, 'connectionPassword');
	const port = Number(readCurrentParameter(context, 'connectionPort'));

	if (
		!host ||
		!database ||
		!user ||
		!password ||
		!Number.isInteger(port) ||
		port < 1 ||
		port > 65535
	) {
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

export function upstreamConnectionProperties(): INodeProperties[] {
	const expression = (field: string): string =>
		`={{ $node["${DATABASE_CONNECTION_NODE}"].parameter["${field}"] }}`;

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

export function connectionFromInput(input: IDataObject): PostgresCredentials | null {
	const port = Number(input.port);
	const host = String(input.host ?? '').trim();
	const database = String(input.database ?? '').trim();
	const user = String(input.user ?? '').trim();
	const password = String(input.password ?? '').trim();

	if (
		!host ||
		!database ||
		!user ||
		!password ||
		!Number.isInteger(port) ||
		port < 1 ||
		port > 65535
	) {
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
