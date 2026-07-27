"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidSqlIdentifier = isValidSqlIdentifier;
exports.assertValidSqlIdentifier = assertValidSqlIdentifier;
/**
 * Validates PostgreSQL identifier candidates before SQL interpolation.
 * Rejects empty strings, pure numeric indices ("0", "1"), and invalid characters.
 */
const SQL_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function isValidSqlIdentifier(value) {
    const normalized = value.trim();
    if (!normalized) {
        return false;
    }
    if (/^\d+$/.test(normalized)) {
        return false;
    }
    return SQL_IDENTIFIER_PATTERN.test(normalized);
}
function assertValidSqlIdentifier(value, label) {
    const normalized = value.trim();
    if (!isValidSqlIdentifier(normalized)) {
        throw new Error(`Identificador SQL inválido para ${label}: "${value}"`);
    }
    return normalized;
}
