export const BTTF_METHOD_IDS = [
	'DIFERENCIA',
	'IGUALDAD',
	'math_add',
	'math_sub',
	'math_diff_abs',
	'math_diff_pct',
	'math_tolerance',
	'math_ratio',
	'strict_equal',
	'normalized_equal',
	'fuzzy_levenshtein',
	'fuzzy_jaro_winkler',
	'contains_check',
	'regex_match',
	'date_diff_seconds',
	'date_diff_days',
	'date_equal',
	'date_tolerance',
	'array_intersection',
	'array_difference',
	'array_jaccard',
	'null_check',
	'boolean_logic',
] as const;

export type BttfMethodId = (typeof BTTF_METHOD_IDS)[number];

/** Official collaps_engine catalog — human-readable English labels for the Method Configurator UI. */
export const BTTF_METHOD_OPTIONS: Array<{ name: string; value: BttfMethodId; description: string }> =
	[
		{
			name: 'Legacy Difference (B - A)',
			value: 'DIFERENCIA',
			description: 'Legacy alias: b - a',
		},
		{
			name: 'Legacy Equality (A == B)',
			value: 'IGUALDAD',
			description: 'Legacy alias: a == b',
		},
		{
			name: 'Mathematical Addition (A + B)',
			value: 'math_add',
			description: 'Numeric: a + b',
		},
		{
			name: 'Mathematical Subtraction (A - B)',
			value: 'math_sub',
			description: 'Numeric: a - b',
		},
		{
			name: 'Absolute Difference (|A - B|)',
			value: 'math_diff_abs',
			description: 'Numeric: |a - b|',
		},
		{
			name: 'Percentage Difference',
			value: 'math_diff_pct',
			description: 'Numeric: percentage difference',
		},
		{
			name: 'Tolerance Check (Numeric Margin)',
			value: 'math_tolerance',
			description: 'Numeric: error margin',
		},
		{
			name: 'Mathematical Ratio (A / B)',
			value: 'math_ratio',
			description: 'Numeric: a / b',
		},
		{
			name: 'Strict Equality',
			value: 'strict_equal',
			description: 'Text: exact equality',
		},
		{
			name: 'Normalized Equality (Trim / Lowercase)',
			value: 'normalized_equal',
			description: 'Text: trim and lowercase equality',
		},
		{
			name: 'Fuzzy Levenshtein Match',
			value: 'fuzzy_levenshtein',
			description: 'Text: Levenshtein similarity',
		},
		{
			name: 'Fuzzy Jaro-Winkler Match',
			value: 'fuzzy_jaro_winkler',
			description: 'Text: Jaro-Winkler similarity',
		},
		{
			name: 'Contains Check (Substring)',
			value: 'contains_check',
			description: 'Text: substring containment',
		},
		{
			name: 'Regex Match',
			value: 'regex_match',
			description: 'Text: regex validation',
		},
		{
			name: 'Date Difference (Seconds)',
			value: 'date_diff_seconds',
			description: 'Date: difference in seconds',
		},
		{
			name: 'Date Difference (Days)',
			value: 'date_diff_days',
			description: 'Date: difference in days',
		},
		{
			name: 'Date Equality (Same Calendar Day)',
			value: 'date_equal',
			description: 'Date: same calendar day',
		},
		{
			name: 'Date Tolerance (Seconds Margin)',
			value: 'date_tolerance',
			description: 'Date: margin in seconds',
		},
		{
			name: 'Array Intersection',
			value: 'array_intersection',
			description: 'Lists: common elements',
		},
		{
			name: 'Array Difference',
			value: 'array_difference',
			description: 'Lists: non-common elements',
		},
		{
			name: 'Array Jaccard Index',
			value: 'array_jaccard',
			description: 'Lists: Jaccard index',
		},
		{
			name: 'Null Check',
			value: 'null_check',
			description: 'Logic: detect nulls',
		},
		{
			name: 'Boolean Logic (AND / OR / XOR)',
			value: 'boolean_logic',
			description: 'Logic: AND/OR/XOR',
		},
	];

/** Default for Global mode UI. Unassigned Per Pair pairs fall back to strict_equal. */
export const DEFAULT_BTTF_METHOD: BttfMethodId = 'math_sub';

export const PER_PAIR_FALLBACK_METHOD: BttfMethodId = 'strict_equal';
