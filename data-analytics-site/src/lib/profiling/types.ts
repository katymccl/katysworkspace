/**
 * Kind of a single non-missing cell value, decided from its text alone.
 * - integer: whole number without leading zeros, e.g. `42`, `-7`, `1,234`
 * - decimal: other finite numbers, e.g. `3.14`, `.5`, `1e6`, `1,234.50`
 * - boolean: `true`/`false`/`yes`/`no` (any case)
 * - date: ISO 8601 date or date-time, or `MM/DD/YYYY` / `DD/MM/YYYY`, with a real calendar day
 * - string: anything else, including numbers with leading zeros such as ZIP codes (`02134`)
 */
export type ValueKind = 'integer' | 'decimal' | 'boolean' | 'date' | 'string'

/**
 * Inferred type of a whole column.
 * - a ValueKind when every non-missing value has that kind (integer + decimal values give `decimal`)
 * - `mixed` when non-missing values have incompatible kinds
 * - `empty` when the column has no non-missing values
 */
export type InferredType = ValueKind | 'mixed' | 'empty'

/** A cell as it arrives from a CSV parser. Anything that isn't a string is stringified for profiling. */
export type RawValue = unknown

export type RawRow = Readonly<Record<string, RawValue>>

export interface ProfileInput {
  /** Column names in file order. Each is profiled by reading `row[name]`. */
  readonly columns: readonly string[]
  readonly rows: readonly RawRow[]
}

export interface ProfileOptions {
  /** How many distinct sample values to keep per column. Default 5. */
  sampleSize?: number
  /** How many most-frequent values to report for categorical columns. Default 10. */
  topValuesLimit?: number
  /**
   * Cell texts (compared trimmed and case-insensitively) that count as missing, in addition to
   * `null`/`undefined`. Default: `''`, `na`, `n/a`, `null`, `none`, `nan`.
   */
  missingTokens?: readonly string[]
}

export interface NumericStats {
  /** Number of values the statistics are computed from (the non-missing values). */
  count: number
  min: number
  max: number
  mean: number
  median: number
}

export interface ValueCount {
  /** The raw cell text, exactly as in the file. */
  value: string
  count: number
  /** count / non-missing values in the column. */
  ratio: number
}

/**
 * Why a column could be its file's primary key. Only integer and string columns where every row has
 * a value and no two match get any; a key that repeats, such as a `Customer ID` in an orders file,
 * points at another file's records and gets none.
 * - id-header: a header word is `id`, `ids`, `identifier`, `uuid` or `guid` (`Library ID`, `shop_id`)
 * - name-header: a header word is `name` or ends in it (`Name`, `first_name`, `username`)
 * - entity-name: the header is the thing an ID column identifies (`Library` beside `Library ID`)
 * - id-like-values: a string column whose every value is a code such as `L-IHL` or `SKU123`
 * - sequential-values: whole numbers that count up through the file, like `1001, 1002, 1003`
 * - unique-values: every value present and different; always the last reason. Without the header,
 *   code or entity reasons it needs at least 20 values: text that is not mostly sentences, or
 *   whole numbers that count up. Small files, comments and measures are often unique by chance.
 */
export type IdentifierReason =
  | { kind: 'id-header' }
  | { kind: 'name-header' }
  | { kind: 'entity-name'; idColumn: string }
  | { kind: 'id-like-values' }
  | { kind: 'sequential-values' }
  | { kind: 'unique-values' }

export interface ColumnProfile {
  name: string
  /** Position of the column in the file, starting at 0. */
  index: number
  inferredType: InferredType
  /** The most common value kind, or null when the column is empty. Useful for `mixed` columns. */
  dominantKind: ValueKind | null
  /** How many non-missing values were classified as each kind. */
  kindCounts: Record<ValueKind, number>
  missingCount: number
  /** missingCount / rowCount, or 0 for a dataset without rows. */
  missingRatio: number
  nonMissingCount: number
  /** Distinct non-missing raw values. Values are compared exactly, so `"a"` and `" a"` differ. */
  distinctCount: number
  /** distinctCount / nonMissingCount, or 0 when there are no non-missing values. */
  uniquenessRatio: number
  /** True when every non-missing value is different and there is at least one: a candidate key. */
  isUnique: boolean
  /** True when there is at least one identifier reason. */
  isPotentialIdentifier: boolean
  /** Why the column could be the file's primary key, in a fixed order. */
  identifierReasons: IdentifierReason[]
  /**
   * True when the user said this column is not an identifier although it has reasons; then
   * isPotentialIdentifier is false and the reasons are kept so the flag can be restored.
   */
  identifierDismissed: boolean
  /** The first distinct non-missing raw values in row order, unmodified. */
  sampleValues: string[]
  /** Set for `integer` and `decimal` columns, otherwise null. */
  numericStats: NumericStats | null
  /**
   * Most frequent raw values for categorical columns (`string`, `boolean` and `mixed`), ordered by
   * count descending, then value ascending. Null for other types.
   */
  topValues: ValueCount[] | null
}

export interface DatasetProfile {
  rowCount: number
  columnCount: number
  /**
   * Rows whose shape didn't match the header: a column was absent from the row, or the parser
   * reported extra fields (PapaParse's `__parsed_extra`). Their values are still profiled.
   */
  malformedRowCount: number
  columns: ColumnProfile[]
}
