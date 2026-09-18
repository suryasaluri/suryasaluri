import oracledb from "oracledb";
import type { TestResult, QueryCostEstimate } from "../types";
import type { IntrospectionProgressEvent } from "../types";
import type { NormalizedSchema } from "../../schema/types";
import { introspectOracleSchema, type OracleExecutor } from "./introspect";

/** Hard stop on a runaway report query — Oracle's mechanical equivalent of "the query errors out instead of running past budget". */
const REPORT_CALL_TIMEOUT_MS = 10_000;

// oracledb runs in Thin mode (pure JS, no Oracle Instant Client) by default —
// Thin mode is only disabled if something calls oracledb.initOracleClient(),
// which this service never does.
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

type OracleConnectFields = { host?: string; port?: string; serviceName?: string; username?: string; password?: string };

function connectString(fields: OracleConnectFields): string {
  return `${fields.host ?? ""}:${fields.port || "1521"}/${fields.serviceName ?? ""}`;
}

function missingFields(fields: OracleConnectFields): boolean {
  return !fields.host || !fields.serviceName || !fields.username || !fields.password;
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Maps a handful of well-known Oracle error numbers to clearer messages. */
function classifyOracleError(e: unknown): TestResult {
  const err = e as { errorNum?: number; message?: string };
  if (err.errorNum === 1017) return { ok: false, message: "Authentication failed: invalid username or password (ORA-01017)" };
  if (err.errorNum === 12154 || err.errorNum === 12514) {
    return { ok: false, message: `Connection failed: unknown service name (ORA-${err.errorNum})` };
  }
  if (err.errorNum === 12541 || err.errorNum === 12170) {
    return { ok: false, message: `Connection failed: host unreachable (ORA-${err.errorNum})` };
  }
  return { ok: false, message: `Connection failed: ${errMessage(e)}` };
}

export async function oracleTestConnection(fields: Record<string, string>): Promise<TestResult> {
  if (missingFields(fields)) return { ok: false, message: "Missing required connection details" };
  let conn: oracledb.Connection | undefined;
  try {
    conn = await oracledb.getConnection({
      user: fields.username,
      password: fields.password,
      connectString: connectString(fields),
    });
    await conn.execute("SELECT 1 FROM DUAL");
    return { ok: true, message: "Connection succeeded" };
  } catch (e) {
    return classifyOracleError(e);
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
}

/**
 * Dry-run cost estimate via Oracle's own EXPLAIN PLAN — no rows are
 * fetched, no bind values are needed (the optimizer plans the statement
 * shape, not the literal values). COST is the optimizer's abstract unit,
 * CARDINALITY its estimated row count; report.ts weighs both against
 * configured caps before ever calling runQuery, the same "look before you
 * run" step a jobs.query dryRun gives on BigQuery.
 */
export async function oracleEstimateQueryCost(fields: Record<string, string>, sql: string): Promise<QueryCostEstimate> {
  let conn: oracledb.Connection | undefined;
  try {
    conn = await oracledb.getConnection({ user: fields.username, password: fields.password, connectString: connectString(fields) });
    const planId = `f_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    await conn.execute(`EXPLAIN PLAN SET STATEMENT_ID = '${planId}' FOR ${sql}`);
    const result = await conn.execute(
      `SELECT COST, CARDINALITY FROM PLAN_TABLE WHERE STATEMENT_ID = :id AND PARENT_ID IS NULL`,
      { id: planId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const row = (result.rows as { COST: number | null; CARDINALITY: number | null }[] | undefined)?.[0];
    await conn.execute(`DELETE FROM PLAN_TABLE WHERE STATEMENT_ID = :id`, { id: planId });
    return { cost: row?.COST ?? 0, cardinality: row?.CARDINALITY ?? 0 };
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
}

/** Executes an already-validated, already-capped (FETCH FIRST n ROWS) report query. callTimeout is the hard stop if the estimate undersold it. */
export async function oracleRunQuery(
  fields: Record<string, string>,
  sql: string,
  binds: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  let conn: oracledb.Connection | undefined;
  try {
    conn = await oracledb.getConnection({ user: fields.username, password: fields.password, connectString: connectString(fields) });
    conn.callTimeout = REPORT_CALL_TIMEOUT_MS;
    const result = await conn.execute(sql, binds as oracledb.BindParameters, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (result.rows as Record<string, unknown>[] | undefined) ?? [];
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
}

export async function oracleIntrospectSchema(
  fields: Record<string, string>,
  onProgress: (event: IntrospectionProgressEvent) => void,
): Promise<NormalizedSchema> {
  let conn: oracledb.Connection | undefined;
  try {
    conn = await oracledb.getConnection({
      user: fields.username,
      password: fields.password,
      connectString: connectString(fields),
    });
    const exec: OracleExecutor = async (sql) => {
      const result = await conn!.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return (result.rows as Record<string, unknown>[] | undefined) ?? [];
    };
    return await introspectOracleSchema(exec, onProgress);
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
}
