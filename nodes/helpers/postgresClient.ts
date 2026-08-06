import type { IDataObject } from 'n8n-workflow';
import type { ILoadOptionsFunctions } from 'n8n-workflow';
import pg from 'pg';

import { logCollapsBlock } from './collapsLogger';

export { logCollapsBlock, logCollapsOperation, queryWithCollapsLog } from './collapsLogger';

export interface PostgresCredentials {
	host: string;
	port: number;
	database: string;
	user: string;
	password: string;
	ssl?: pg.ClientConfig['ssl'];
}

function buildClientConfig(credentials: PostgresCredentials): pg.ClientConfig {
	return {
		host: credentials.host,
		port: credentials.port,
		database: credentials.database,
		user: credentials.user,
		password: credentials.password,
		ssl: credentials.ssl ?? { rejectUnauthorized: false },
	};
}

export function resolveConnectionConfig(
	input: IDataObject = {},
	overrides: Partial<PostgresCredentials> = {},
): PostgresCredentials | null {
	const host = String(overrides.host ?? input.host ?? '').trim();
	const port = Number(overrides.port ?? input.port);
	const database = String(overrides.database ?? input.database ?? '').trim();
	const user = String(overrides.user ?? input.user ?? '').trim();
	const password = String(overrides.password ?? input.password ?? '').trim();

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

export function toPostgresError(error: unknown): Error {
	const message = error instanceof Error ? error.message : String(error);
	return new Error(`[PostgreSQL Error] ${message}`);
}

export async function withPostgresConnection<T>(
	connection: PostgresCredentials,
	fn: (client: pg.Client) => Promise<T>,
): Promise<T> {
	const client = new pg.Client(buildClientConfig(connection));

	try {
		logCollapsBlock({
			node: 'postgresClient',
			context: 'withPostgresConnection()',
			note: `Conectando a ${connection.host}/${connection.database} como ${connection.user}`,
		});
		await client.connect();
		return await fn(client);
	} catch (error) {
		logCollapsBlock({
			node: 'postgresClient',
			context: 'withPostgresConnection()',
			note: `Error al conectar o consultar: ${error instanceof Error ? error.message : String(error)}`,
		});
		throw toPostgresError(error);
	} finally {
		await client.end().catch(() => undefined);
	}
}

export async function withPostgresClient<T>(
	_context: ILoadOptionsFunctions,
	fn: (client: pg.Client) => Promise<T>,
	connectionOverride?: PostgresCredentials,
): Promise<T> {
	if (!connectionOverride) {
		throw new Error(
			'PostgreSQL credentials are required from the connected COLLAPS Database Connection.',
		);
	}

	return withPostgresConnection(connectionOverride, fn);
}

export function resolveSchema(schema?: string): string {
	return schema?.trim() ? schema.trim() : 'public';
}

export function resolveSelectorSchema(schema?: string): string {
	return schema?.trim() ?? '';
}

export function resolveSchemaFromStream(
	schemaParam: string | undefined,
	input: IDataObject,
): string {
	const fromParam = schemaParam?.trim();
	if (fromParam) {
		return fromParam;
	}

	const selectedSchema = (input.selectedSchema as string | undefined)?.trim();
	if (selectedSchema) {
		return selectedSchema;
	}

	const schema = (input.schema as string | undefined)?.trim();
	if (schema) {
		return schema;
	}

	return '';
}

export function quoteIdentifier(identifier: string): string {
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
		throw new Error(`Identificador SQL inválido: "${identifier}"`);
	}

	return `"${identifier.replace(/"/g, '""')}"`;
}
