"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCamelCaseIdentifier = toCamelCaseIdentifier;
exports.buildTargetTableName = buildTargetTableName;
exports.buildWorkTableName = buildWorkTableName;
const SQL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
function toCamelCaseIdentifier(value) {
    const words = value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[^A-Za-z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.toLowerCase());
    if (words.length === 0) {
        throw new Error('The name must contain at least one letter or number.');
    }
    const camelCase = words[0] +
        words
            .slice(1)
            .map((word) => word[0].toUpperCase() + word.slice(1))
            .join('');
    const identifier = /^\d/.test(camelCase) ? `_${camelCase}` : camelCase;
    if (!SQL_IDENTIFIER_PATTERN.test(identifier)) {
        throw new Error(`Invalid generated identifier: "${identifier}"`);
    }
    return identifier;
}
function buildTargetTableName(analysisName) {
    return `c_results_${toCamelCaseIdentifier(analysisName)}`;
}
function buildWorkTableName(name) {
    return `w_table_${toCamelCaseIdentifier(name)}`;
}
