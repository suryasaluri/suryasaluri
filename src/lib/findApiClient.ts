import { supabase } from "@/integrations/supabase/client";

const BASE_URL = import.meta.env.VITE_FIND_SERVICE_URL || "http://localhost:4001";

export type FieldSpec = {
  key: string;
  label: string;
  type: "text" | "password" | "number";
  placeholder?: string;
};

export type ConnectorMeta = {
  id: string;
  label: string;
  category: "Database";
  connectorType: string;
  defaultPort?: number;
  fields: FieldSpec[];
};

export type TestResult = {
  ok: boolean;
  message: string;
  meta?: Record<string, unknown>;
};

export type ConnectionRecord = {
  id: string;
  org_id: string;
  name: string;
  service_type: string;
  connector_id: string | null;
  integration_mode: string | null;
  host: string | null;
  port: number | null;
  service_name: string | null;
  username: string | null;
  connector_type: string | null;
  status: string;
  category: string | null;
  credential_label: string | null;
  connected_at: string | null;
  sensitivity_labels: unknown;
  created_at: string;
};

export type StatusFieldCandidate = {
  table: string;
  column: string;
  candidateValues: string[] | null;
  source: "check_constraint" | "name_heuristic";
};

export type CrawlRecord = {
  id: string;
  data_source_id: string;
  status: string;
  tables_found: number | null;
  views_found: number | null;
  status_fields: StatusFieldCandidate[];
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type ColumnDef = { name: string; dataType: string; nullable: boolean };
export type ForeignKeyDef = { constraintName: string; columns: string[]; refTable: string; refColumns: string[] };
export type TableDef = {
  name: string;
  objectType: "TABLE" | "VIEW";
  columns: ColumnDef[];
  primaryKey: string[];
  foreignKeys: ForeignKeyDef[];
  rowEstimate: number | null;
  sensitivityLabels?: string[];
};
export type RelationshipEdge = { fromTable: string; fromColumns: string[]; toTable: string; toColumns: string[]; constraintName: string };

export type SchemaResponse = {
  tables: TableDef[];
  relationships: RelationshipEdge[];
  statusFields: StatusFieldCandidate[];
  lastCrawledAt: string | null;
};

export type DocumentationSnapshot = {
  id: string;
  technical_markdown: string;
  functional_markdown: string | null;
  generated_at: string;
};

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
      // fall back to statusText
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

  listConnections: () => request<ConnectionRecord[]>("/connections"),
  registerConnection: (body: { name?: string; connectorId: string; fields: Record<string, string> }) =>
    request<ConnectionRecord>("/connections", { method: "POST", body: JSON.stringify(body) }),
  testConnection: (id: string, fields: Record<string, string>) =>
    request<ConnectionRecord>(`/connections/${id}/test`, { method: "POST", body: JSON.stringify({ fields }) }),
  deleteConnection: (id: string) => request<void>(`/connections/${id}`, { method: "DELETE" }),

  listCrawls: (connectionId: string) => request<CrawlRecord[]>(`/connections/${connectionId}/crawls`),
  startCrawl: (connectionId: string, fields: Record<string, string>) =>
    request<{ id: string; status: string }>(`/connections/${connectionId}/crawl`, { method: "POST", body: JSON.stringify({ fields }) }),

  getSchema: (connectionId: string) => request<SchemaResponse>(`/connections/${connectionId}/schema`),

  getDocumentation: (connectionId: string) => request<DocumentationSnapshot>(`/connections/${connectionId}/documentation`),
  regenerateDocumentation: (connectionId: string) =>
    request<DocumentationSnapshot>(`/connections/${connectionId}/documentation/regenerate`, { method: "POST" }),
};

type CrawlStreamHandlers = {
  onTableFound?: (data: unknown) => void;
  onCompleted?: (data: unknown) => void;
  onError?: (data: unknown) => void;
};

/**
 * Manually parses the /crawls/:id/stream SSE response via fetch (rather than
 * the native EventSource, which can't send an Authorization header) so the
 * crawl progress stream authenticates the same way as every other call.
 */
export function streamCrawl(crawlId: string, handlers: CrawlStreamHandlers): { cancel: () => void } {
  const controller = new AbortController();

  (async () => {
    const headers = await authHeader();
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/crawls/${crawlId}/stream`, { headers, signal: controller.signal });
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
        if (type === "table_found") handlers.onTableFound?.(payload);
        else if (type === "completed") handlers.onCompleted?.(payload);
        else if (type === "error") handlers.onError?.(payload);
      }
    }
  })().catch(() => {});

  return { cancel: () => controller.abort() };
}
