"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readTableNameFromJson = readTableNameFromJson;
exports.normalizeSelectedTableName = normalizeSelectedTableName;
exports.resolveTableNameFromSources = resolveTableNameFromSources;
exports.parseTablesInput = parseTablesInput;
exports.parseColumnsInput = parseColumnsInput;
exports.toOptions = toOptions;
exports.mergeColumnOptions = mergeColumnOptions;
const dynamoMatching_1 = require("./dynamoMatching");
const sqlValidation_1 = require("./sqlValidation");
function readTableNameFromJson(input) {
    var _a, _b;
    const candidate = String((_b = (_a = input.tableName) !== null && _a !== void 0 ? _a : input.table_name) !== null && _b !== void 0 ? _b : '').trim();
    return (0, sqlValidation_1.isValidSqlIdentifier)(candidate) ? candidate : '';
}
function normalizeSelectedTableName(value) {
    let candidate = '';
    if (typeof value === 'string') {
        candidate = value.trim();
    }
    else if (value && typeof value === 'object') {
        const record = value;
        if (typeof record.value === 'string') {
            candidate = record.value.trim();
        }
        else if (typeof record.name === 'string') {
            candidate = record.name.trim();
        }
    }
    else if (value !== undefined && value !== null) {
        candidate = String(value).trim();
    }
    return (0, sqlValidation_1.isValidSqlIdentifier)(candidate) ? candidate : '';
}
function resolveTableNameFromSources(parameterValue, input) {
    const fromParameter = normalizeSelectedTableName(parameterValue);
    if (fromParameter && !fromParameter.startsWith('={{')) {
        return fromParameter;
    }
    return readTableNameFromJson(input);
}
function parseTablesInput(value) {
    return (0, dynamoMatching_1.parseStringList)(value);
}
function parseColumnsInput(value) {
    if (Array.isArray(value)) {
        return value
            .map((entry) => {
            if (typeof entry === 'string') {
                return entry.trim();
            }
            if (entry && typeof entry === 'object') {
                const record = entry;
                if (typeof record.name === 'string') {
                    return record.name.trim();
                }
                if (typeof record.column_name === 'string') {
                    return record.column_name.trim();
                }
            }
            return '';
        })
            .filter(Boolean);
    }
    return (0, dynamoMatching_1.parseStringList)(value);
}
function toOptions(values) {
    return values.map((value) => ({
        name: value,
        value,
    }));
}
function mergeColumnOptions(baseOptions, ...valueGroups) {
    var _a;
    const merged = new Map();
    for (const option of baseOptions) {
        const value = String(option.value).trim();
        if (!value) {
            continue;
        }
        merged.set(value, {
            name: String((_a = option.name) !== null && _a !== void 0 ? _a : value),
            value,
        });
    }
    for (const group of valueGroups) {
        const values = parseColumnsInput(group);
        for (const value of values) {
            if (!merged.has(value)) {
                merged.set(value, { name: value, value });
            }
        }
    }
    return Array.from(merged.values());
}
