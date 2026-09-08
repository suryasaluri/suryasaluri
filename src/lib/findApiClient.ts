import { supabase } from "@/integrations/supabase/client";

const BASE_URL = import.meta.env.VITE_FIND_SERVICE_URL || "http://localhost:4001";

export type ConnectorCategory = "Database" | "Warehouse" | "SaaS" | "Storage" | "Streaming";

export type FieldSpec = {
  key: string;
  label: string;
  type: "text" | "password" | "number";
  placeholder?: string;
};

export type ConnectorMeta = {
  id: string;
  label: string;
  category: ConnectorCategory;
  connectorType: string;
  defaultPort?: number;
  integration: "real" | "simulated";
  fields: FieldSpec[];
};

export type TestResult = {
  ok: boolean;
  message: string;
  meta?: Record<string, unknown>;
};

export type DataSourceRecord = {
  id: string;
  org_id: string;
  name: string;
  service_type: string;
  connector_id: string | null;
  integration_mode: string | null;
  host: string | null;
  port: number | null;
  connector_type: string | null;
  status: string;
  category: string | null;
  table_count: number | null;
  row_count: number | null;
  difficulty_score: number | null;
  sensitivity_labels: unknown;
  tags: unknown;
  credential_label: string | null;
  connected_at: string | null;
  notes: string | null;
  schema_metadata: unknown;
  created_at: string;
  last_discovery: string | null;
};

export type ScanRecord = {
  id: string;
  org_id: string;
  scan_type: string;
  target: string | null;
  status: string;
  sources_found: number | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type SchemaTable = { table: string; rows: number; columns: string[] };
export type AuditEntry = { id: string; action: string; created_at: string; details: unknown };

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = { "Content-Type": "application/json", ...(await authHeader()), ...(init?.headers ?? {}) };
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore — fall back to statusText
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const findApi = {
  getConnectors: () => request<ConnectorMeta[]>("/connectors"),
  testConnector: (id: string, fields: Record<string, string>) =>
    request<TestResult>(`/connectors/${id}/test`, { method: "POST", body: JSON.stringify({ fields }) }),

  listSources: () => request<DataSourceRecord[]>("/sources"),
  createSource: (body: { name?: string; connectorId: string; fields: Record<string, string> }) =>
    request<DataSourceRecord>("/sources", { method: "POST", body: JSON.stringify(body) }),
  lifecycle: (id: string, action: "connect" | "authenticate" | "firewall-request" | "disconnect") =>
    request<DataSourceRecord>(`/sources/${id}/${action}`, { method: "POST" }),
  deleteSource: (id: string) => request<void>(`/sources/${id}`, { method: "DELETE" }),
  bulkAction: (ids: string[], action: "connect" | "delete") =>
    request<{ ok: true }>("/sources/bulk", { method: "POST", body: JSON.stringify({ ids, action }) }),
  getSchema: (id: string) => request<SchemaTable[]>(`/sources/${id}/schema`),
  getAudit: (id: string) => request<AuditEntry[]>(`/sources/${id}/audit`),

  listScans: () => request<ScanRecord[]>("/scans"),
  startScan: (scanType: string, target?: string) =>
    request<{ id: string; status: string }>("/scans", { method: "POST", body: JSON.stringify({ scanType, target }) }),
};

type StreamHandlers = {
  onFound?: (data: unknown) => void;
  onCompleted?: (data: unknown) => void;
  onError?: (data: unknown) => void;
};

/**
 * Manually parses the /scans/:id/stream SSE response via fetch (rather than
 * the native EventSource, which can't send an Authorization header) so the
 * scan progress stream authenticates the same way as every other call.
 */
export function streamScan(scanId: string, handlers: StreamHandlers): { cancel: () => void } {
  const controller = new AbortController();

  (async () => {
    const headers = await authHeader();
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/scans/${scanId}/stream`, { headers, signal: controller.signal });
    } catch {
      return;
    }
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sepIndex: number;
      while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        const eventMatch = /^event:\s*(.+)$/m.exec(rawEvent);
        const dataMatch = /^data:\s*(.+)$/m.exec(rawEvent);
        if (!dataMatch) continue;
        const type = eventMatch?.[1]?.trim() ?? "message";
        let payload: unknown;
        try {
          payload = JSON.parse(dataMatch[1]);
        } catch {
          payload = dataMatch[1];
        }
        if (type === "found") handlers.onFound?.(payload);
        else if (type === "completed") handlers.onCompleted?.(payload);
        else if (type === "error") handlers.onError?.(payload);
      }
    }
  })().catch(() => {});

  return { cancel: () => controller.abort() };
}
