export type QueryRow = Record<string, unknown>;

export interface ResultSetHeader {
  insertId: number;
  affectedRows: number;
}

export function asRows(result: unknown): QueryRow[] {
  return Array.isArray(result) ? (result as QueryRow[]) : [];
}

export function asResultHeader(result: unknown): ResultSetHeader {
  return result as ResultSetHeader;
}
