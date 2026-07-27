import type { IDataObject } from 'n8n-workflow';
import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
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

export const CLOUDSQL_PUBLIC_HOST = '136.116.101.31';
export const DEFAULT_SELECTOR_SCHEMA = 's00001_incancer';

export const DEFAULT_POSTGRES_CREDENTIALS: PostgresCredentials = {
	host: CLOUDSQL_PUBLIC_HOST,
	port: 5432,
	user: 'n8n_user',
	password: 'COLLAPS_n8n_2026!',
	database: 'collaps',
	ssl: { rejectUnauthorized: false },
};

type PostgresContext = ILoadOptionsFunctions | IExecuteFunctions;

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
): PostgresCredentials {
	return {
		host: String(overrides.host ?? input.host ?? DEFAULT_POSTGRES_CREDENTIALS.host),
		port: Number(overrides.port ?? input.port ?? DEFAULT_POSTGRES_CREDENTIALS.port),
		database: String(overrides.database ?? input.database ?? DEFAULT_POSTGRES_CREDENTIALS.database),
		user: String(overrides.user ?? input.user ?? DEFAULT_POSTGRES_CREDENTIALS.user),
		password: String(overrides.password ?? input.password ?? DEFAULT_POSTGRES_CREDENTIALS.password),
		ssl: { rejectUnauthorized: false },
	};
}

async function resolveCredentials(context: PostgresContext): Promise<PostgresCredentials | null> {
	try {
		const credentials = await context.getCredentials('postgres');
		if (credentials?.host) {
			return {
				host: credentials.host as string,
				port: (credentials.port as number) ?? 5432,
				database: credentials.database as string,
				user: credentials.user as string,
				password: credentials.password as string,
				ssl: { rejectUnauthorized: false },
			};
		}
	} catch {
		// Zero-Form: usar IP pública COLLAPS por defecto
	}

	return null;
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
	context: PostgresContext,
	fn: (client: pg.Client) => Promise<T>,
	connectionOverride?: PostgresCredentials,
): Promise<T> {
	const credentials =
		connectionOverride ?? (await resolveCredentials(context)) ?? DEFAULT_POSTGRES_CREDENTIALS;

	return withPostgresConnection(credentials, fn);
}

export function resolveSchema(schema?: string): string {
	return schema?.trim() ? schema.trim() : 'public';
}

export function resolveSelectorSchema(schema?: string): string {
	return schema?.trim() ? schema.trim() : DEFAULT_SELECTOR_SCHEMA;
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

	return DEFAULT_SELECTOR_SCHEMA;
}

export function quoteIdentifier(identifier: string): string {
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
		throw new Error(`Identificador SQL inválido: "${identifier}"`);
	}

	return `"${identifier.replace(/"/g, '""')}"`;
}
