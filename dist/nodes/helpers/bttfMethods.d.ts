export declare const BTTF_METHOD_IDS: readonly ["DIFERENCIA", "IGUALDAD", "math_add", "math_sub", "math_diff_abs", "math_diff_pct", "math_tolerance", "math_ratio", "strict_equal", "normalized_equal", "fuzzy_levenshtein", "fuzzy_jaro_winkler", "contains_check", "regex_match", "date_diff_seconds", "date_diff_days", "date_equal", "date_tolerance", "array_intersection", "array_difference", "array_jaccard", "null_check", "boolean_logic"];
export type BttfMethodId = (typeof BTTF_METHOD_IDS)[number];
/** Official collaps_engine catalog — human-readable English labels for the Method Configurator UI. */
export declare const BTTF_METHOD_OPTIONS: Array<{
    name: string;
    value: BttfMethodId;
    description: string;
}>;
/** Default for Global mode UI. Unassigned Per Pair pairs fall back to strict_equal. */
export declare const DEFAULT_BTTF_METHOD: BttfMethodId;
export declare const PER_PAIR_FALLBACK_METHOD: BttfMethodId;
