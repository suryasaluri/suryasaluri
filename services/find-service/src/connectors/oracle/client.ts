import oracledb from "oracledb";
import type { TestResult } from "../types";
import type { IntrospectionProgressEvent } from "../types";
import type { NormalizedSchema } from "../../schema/types";
import { introspectOracleSchema, type OracleExecutor } from "./introspect";

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
