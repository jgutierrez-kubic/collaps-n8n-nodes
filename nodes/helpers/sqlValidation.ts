/**
 * Validates PostgreSQL identifier candidates before SQL interpolation.
 * Rejects empty strings, pure numeric indices ("0", "1"), and invalid characters.
 */
const SQL_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function isValidSqlIdentifier(value: string): boolean {
	const normalized = value.trim();

	if (!normalized) {
		return false;
	}

	if (/^\d+$/.test(normalized)) {
		return false;
	}

	return SQL_IDENTIFIER_PATTERN.test(normalized);
}

export function assertValidSqlIdentifier(value: string, label: string): string {
	const normalized = value.trim();

	if (!isValidSqlIdentifier(normalized)) {
		throw new Error(`Identificador SQL inválido para ${label}: "${value}"`);
	}

	return normalized;
}
