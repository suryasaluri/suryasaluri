import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Plus, Loader2, Trash2, RefreshCw, ChevronDown, Table2, Waypoints, Tags,
  FileText, Sparkles, Plug, ShieldCheck, Brain, BarChart3, Play, Gauge, Ban, Send,
  BookOpen, Bot, Download, AlertTriangle, Link2Off, KeyRound, Link2,
} from "lucide-react";
import { iconFor, SENSITIVITY_STYLE } from "@/lib/connectors";
import { downloadTextFile, downloadMarkdownAsPdf, downloadReportCsv, downloadReportPdf, downloadReportDoc } from "@/lib/exportDocs";
import { RelationshipDiagram } from "@/components/RelationshipDiagram";
import {
  findApi, streamCrawl, type ConnectionRecord, type TableDef,
  type ReportTemplate, type ReportOutcome, type CostEstimate, type CopilotAnswer,
} from "@/lib/findApiClient";

export const Route = createFileRoute("/_authenticated/app/find")({
  component: FindPage,
});

const STATUS_META: Record<string, { label: string; cls: string }> = {
  connected: { label: "Connected", cls: "bg-success/15 text-success border-success/30" },
  auth_required: { label: "Auth required", cls: "bg-warning/15 text-warning border-warning/30" },
  unreachable: { label: "Unreachable", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

function labels(json: unknown): string[] {
  return Array.isArray(json) ? (json as string[]) : [];
}

const STRING_TYPE_RE = /^(VARCHAR2|CHAR|NVARCHAR2|NCHAR)/i;
const NUMERIC_TYPE_RE = /^(NUMBER|FLOAT|BINARY_DOUBLE|BINARY_FLOAT)/i;

/** A plain-language stand-in for a raw confidence score — the number still shows as a bar, but the word is what a non-technical reader actually needs. */
function confidenceLabel(score: number): string {
  if (score >= 0.9) return "Very confident";
  if (score >= 0.75) return "Confident";
  if (score >= 0.5) return "Somewhat confident";
  return "Low confidence";
}

/** The credential fields a fresh test/crawl/report run needs — password is never stored, so every action asks for it again. */
type CredentialActionInput =
  | { kind: "test" }
  | { kind: "crawl" }
  | { kind: "run"; template: ReportTemplate }
  | { kind: "custom"; text: string };
type CredentialAction = CredentialActionInput & { connectionId: string; connectorId: string | null };

/** Renders one connector field by its declared type — a native file input for "file" (reads client-side via FileReader, never touches the server until submit), a plain Input otherwise. A "file" field's paired `<key>Name` field is filled in automatically from the chosen File object, never shown to the user directly (the connector marks it `hidden`). */
function FieldInput({ field, value, onChange }: { field: import("@/lib/findApiClient").FieldSpec; value: string; onChange: (key: string, value: string) => void }) {
  if (field.type === "file") {
    return (
      <input
        type="file"
        accept=".csv,.xlsx,.xls"
        className="block w-full text-xs text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            onChange(field.key, String(reader.result ?? ""));
            onChange(`${field.key}Name`, file.name);
          };
          reader.readAsDataURL(file);
        }}
      />
    );
  }
  return (
    <Input
      type={field.type === "number" ? "number" : field.type}
      value={value}
      onChange={(e) => onChange(field.key, e.target.value)}
      placeholder={field.placeholder}
    />
  );
}

function CostPanel({ estimate, cached, latencyMs }: { estimate: CostEstimate; cached: boolean; latencyMs?: number }) {
  if (estimate.blocked) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-xs">
        <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
        <div>
          <span className="font-medium text-destructive">Blocked by cost cap</span> — dry-run estimate (cost {estimate.cost.toLocaleString()}, ~{estimate.cardinality.toLocaleString()} rows) exceeds the configured threshold. Query was not executed.
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-lg bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
      <Gauge className="h-3.5 w-3.5 shrink-0 text-primary" />
      {cached ? (
        <span><span className="font-medium text-primary">Cache hit</span> · 0 rows scanned · served from the last 24h</span>
      ) : (
        <span><span className="font-medium text-foreground">Live query</span> · ~{latencyMs ?? 0}ms · dry-run cost {estimate.cost.toLocaleString()}, ~{estimate.cardinality.toLocaleString()} est. rows</span>
      )}
    </div>
  );
}

function ReportResultView({ outcome, filename }: { outcome: ReportOutcome; filename: string }) {
  if (outcome.status === "validation_error") {
    return (
      <div className="space-y-1.5 rounded-lg bg-destructive/10 px-3 py-2.5 text-xs">
        <div className="font-medium text-destructive">Validation failed — nothing was sent to the database</div>
        {outcome.errors.map((e, i) => (
          <div key={i} className="text-muted-foreground">
            <span className="font-mono text-destructive">{e.field}</span> — {e.reason}
            {e.suggestions.length > 0 && <> Did you mean: {e.suggestions.map((s) => <span key={s} className="font-mono text-primary"> {s}</span>)}?</>}
          </div>
        ))}
      </div>
    );
  }
  const rows = outcome.status === "success" ? outcome.rows : [];
  const max = Math.max(1, ...rows.map((r) => Number(r.agg_value) || 0));
  return (
    <div className="space-y-3">
      <pre className="overflow-x-auto rounded-lg bg-secondary/40 p-3 font-mono text-[11px] text-muted-foreground">{outcome.sql}</pre>
      <CostPanel estimate={outcome.estimate} cached={outcome.status === "success" && outcome.cached} latencyMs={outcome.status === "success" ? outcome.latencyMs : undefined} />
      {outcome.status === "success" && rows.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => downloadReportCsv(`${filename}.csv`, rows)}><Download className="mr-2 h-3 w-3" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={() => downloadReportPdf(`${filename}.pdf`, filename, outcome.sql, rows)}><Download className="mr-2 h-3 w-3" /> PDF</Button>
          <Button size="sm" variant="outline" onClick={() => downloadReportDoc(`${filename}.doc`, filename, outcome.sql, rows)}><Download className="mr-2 h-3 w-3" /> Document</Button>
        </div>
      )}
      {outcome.status === "success" && (
        rows.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">No rows returned.</div>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r, i) => {
              const value = Number(r.agg_value) || 0;
              const pct = Math.max(2, Math.round((value / max) * 100));
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-28 shrink-0 truncate text-muted-foreground">{String(r.group_value)}</div>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-secondary/40">
                    <div className="h-full rounded bg-primary/70" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-20 shrink-0 text-right font-mono">{value.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function FindPage() {
  const qc = useQueryClient();

  const { data: connectors } = useQuery({ queryKey: ["connectors"], queryFn: findApi.getConnectors });

  const { data: connections } = useQuery({ queryKey: ["connections"], queryFn: findApi.listConnections });
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    if (!activeId && connections?.length) setActiveId(connections[0].id);
  }, [connections, activeId]);
  const active = connections?.find((c) => c.id === activeId) ?? null;

  // Which connector's fields a dialog should render — the one picked in the
  // register dialog, or whichever one the active/target connection actually
  // used (Oracle and file uploads take different field sets).
  const [registerConnectorId, setRegisterConnectorId] = useState<string | null>(null);
  const registerConnector = connectors?.find((c) => c.id === registerConnectorId) ?? connectors?.[0];

  const [tab, setTab] = useState("schema");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // --- register dialog ---
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerFields, setRegisterFields] = useState<Record<string, string>>({});
  const [testState, setTestState] = useState<"idle" | "testing" | "pass" | "fail">("idle");
  const [testMessage, setTestMessage] = useState("");

  const testConnector = useMutation({
    mutationFn: async () => {
      setTestState("testing");
      setTestMessage("");
      return findApi.testConnector(registerConnector!.id, registerFields);
    },
    onSuccess: (result) => { setTestState(result.ok ? "pass" : "fail"); setTestMessage(result.message); },
    onError: (e: unknown) => { setTestState("fail"); setTestMessage(errMsg(e)); },
  });

  const registerConnection = useMutation({
    mutationFn: () => findApi.registerConnection({ name: registerName, connectorId: registerConnector!.id, fields: registerFields }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["connections"] });
      toast.success("Connection registered");
      setActiveId(data.id);
      setRegisterOpen(false);
      setRegisterName(""); setRegisterFields({}); setTestState("idle"); setTestMessage("");
    },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });

  const deleteConnection = useMutation({
    mutationFn: (id: string) => findApi.deleteConnection(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["connections"] });
      if (activeId === id) setActiveId(null);
      setDeleteId(null);
      toast.success("Connection deleted");
    },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });

  // --- re-test / crawl / report-run credential prompt (password is never persisted) ---
  const [credentialAction, setCredentialAction] = useState<CredentialAction | null>(null);
  const [credentialFields, setCredentialFields] = useState<Record<string, string>>({});
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  function openCredentialPrompt(conn: ConnectionRecord, action: CredentialActionInput) {
    setCredentialAction({ connectionId: conn.id, connectorId: conn.connector_id, ...action } as CredentialAction);
    setCredentialFields({
      host: conn.host ?? "", port: conn.port ? String(conn.port) : "", serviceName: conn.service_name ?? "",
      username: conn.username ?? "", password: "",
    });
    setFilterValues({});
  }

  const retest = useMutation({
    mutationFn: (vars: { id: string; fields: Record<string, string> }) => findApi.testConnection(vars.id, vars.fields),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["connections"] }); toast.success("Connection re-tested"); setCredentialAction(null); },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });

  // --- crawl ---
  const [crawling, setCrawling] = useState(false);
  const [liveFeed, setLiveFeed] = useState<{ name: string; objectType: string }[]>([]);

  const crawl = useMutation({
    mutationFn: async (vars: { id: string; fields: Record<string, string> }) => {
      setLiveFeed([]);
      const { id: crawlId } = await findApi.startCrawl(vars.id, vars.fields);
      return new Promise<{ tablesFound: number; viewsFound: number }>((resolve, reject) => {
        streamCrawl(crawlId, {
          onTableFound: (t) => setLiveFeed((f) => [...f, t as { name: string; objectType: string }]),
          onCompleted: (payload) => resolve(payload as { tablesFound: number; viewsFound: number }),
          onError: (payload) => reject(new Error((payload as { message?: string })?.message ?? "Crawl failed")),
        });
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["connections"] });
      qc.invalidateQueries({ queryKey: ["schema", activeId] });
      qc.invalidateQueries({ queryKey: ["crawls", activeId] });
      setCredentialAction(null);
      setTimeout(() => setLiveFeed([]), 2200);
      toast.success(`Crawl complete — ${res.tablesFound} table${res.tablesFound === 1 ? "" : "s"}, ${res.viewsFound} view${res.viewsFound === 1 ? "" : "s"}`);
    },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });
  const crawlPending = crawl.isPending;

  // --- domain classification ---
  const { data: domain, isLoading: domainLoading } = useQuery({
    queryKey: ["domain", activeId],
    queryFn: () => findApi.getDomain(activeId!),
    enabled: !!activeId && tab === "domain",
  });
  const regenerateDomain = useMutation({
    mutationFn: () => findApi.regenerateDomain(activeId!),
    onSuccess: (data) => { qc.setQueryData(["domain", activeId], data); toast.success("Domain classification " + ("unavailable" in data ? "unavailable" : "regenerated")); },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });

  // --- business glossary — the reconstructed "logic" layer ---
  const { data: glossary, isLoading: glossaryLoading } = useQuery({
    queryKey: ["glossary", activeId],
    queryFn: () => findApi.getGlossary(activeId!),
    enabled: !!activeId && tab === "glossary",
  });
  const regenerateGlossary = useMutation({
    mutationFn: () => findApi.regenerateGlossary(activeId!),
    onSuccess: (data) => { qc.setQueryData(["glossary", activeId], data); toast.success("Glossary " + ("unavailable" in data ? "unavailable" : "regenerated")); },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });

  // --- AI copilot: grounded schema/glossary/documentation Q&A, never runs SQL itself ---
  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [copilotAnswer, setCopilotAnswer] = useState<CopilotAnswer | null>(null);
  const askCopilot = useMutation({
    mutationFn: (vars: { id: string; question: string }) => findApi.askCopilot(vars.id, vars.question),
    onSuccess: (result) => {
      if ("unavailable" in result) { toast.error(result.reason); setCopilotAnswer(null); }
      else setCopilotAnswer(result);
    },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });

  /** A citation ref ("table" or "table.column") jumps to the Schema tab and expands that table — the same "click a citation, land at the source" behavior a grounded answer should give. */
  function jumpToCitation(ref: string) {
    const tableName = ref.split(".")[0];
    setExpandedTables((prev) => new Set(prev).add(tableName));
    setTab("schema");
  }

  // --- reports: suggestions + running (suggested or custom) ---
  const { data: reportSuggestions } = useQuery({
    queryKey: ["reportSuggestions", activeId],
    queryFn: () => findApi.getReportSuggestions(activeId!),
    enabled: !!activeId && tab === "reports",
  });
  const [reportOutcomes, setReportOutcomes] = useState<Record<string, ReportOutcome>>({});
  const [customText, setCustomText] = useState("");
  const [customOutcome, setCustomOutcome] = useState<ReportOutcome | null>(null);

  // --- click-to-build report: pick real attributes instead of typing ---
  const [builderTable, setBuilderTable] = useState<string | null>(null);
  const [builderGroupBy, setBuilderGroupBy] = useState<string | null>(null);
  const [builderMeasure, setBuilderMeasure] = useState<string | null>(null);
  const [builderAgg, setBuilderAgg] = useState<"count" | "sum" | "avg">("count");

  const runReport = useMutation({
    mutationFn: (vars: { id: string; templateId: string; fields: Record<string, string>; filterValues: Record<string, string> }) =>
      findApi.runReport(vars.id, { templateId: vars.templateId, fields: vars.fields, filterValues: vars.filterValues }),
    onSuccess: (outcome, vars) => {
      setReportOutcomes((prev) => ({ ...prev, [vars.templateId]: outcome }));
      setCredentialAction(null);
      if (outcome.status === "blocked") toast.warning("Blocked by cost cap — see the report card for detail");
      else if (outcome.status === "validation_error") toast.error("Validation failed — see the report card for detail");
      else toast.success(outcome.cached ? "Served from cache" : "Report ran");
    },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });

  const runCustom = useMutation({
    mutationFn: (vars: { id: string; text: string; fields: Record<string, string> }) => findApi.runCustomReport(vars.id, { text: vars.text, fields: vars.fields }),
    onSuccess: (outcome) => {
      setCustomOutcome(outcome);
      setCredentialAction(null);
      if (outcome.status === "blocked") toast.warning("Blocked by cost cap");
      else if (outcome.status === "validation_error") toast.error("Couldn't build a safe query from that request");
      else toast.success(outcome.cached ? "Served from cache" : "Report generated");
    },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });

  function submitCredentialPrompt() {
    if (!credentialAction) return;
    if (credentialAction.kind === "test") retest.mutate({ id: credentialAction.connectionId, fields: credentialFields });
    else if (credentialAction.kind === "crawl") crawl.mutate({ id: credentialAction.connectionId, fields: credentialFields });
    else if (credentialAction.kind === "run") runReport.mutate({ id: credentialAction.connectionId, templateId: credentialAction.template.id, fields: credentialFields, filterValues });
    else runCustom.mutate({ id: credentialAction.connectionId, text: credentialAction.text, fields: credentialFields });
  }
  const credentialPending = retest.isPending || crawlPending || runReport.isPending || runCustom.isPending;

  // --- schema / documentation for the active connection ---
  const { data: schema } = useQuery({
    queryKey: ["schema", activeId],
    queryFn: () => findApi.getSchema(activeId!),
    enabled: !!activeId,
  });

  const { data: documentation, isLoading: docLoading } = useQuery({
    queryKey: ["documentation", activeId],
    queryFn: () => findApi.getDocumentation(activeId!),
    enabled: !!activeId && tab === "documentation",
  });

  const regenerateDocs = useMutation({
    mutationFn: () => findApi.regenerateDocumentation(activeId!),
    onSuccess: (data) => { qc.setQueryData(["documentation", activeId], data); toast.success("Documentation regenerated"); },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });

  const docFileBase = (active?.name ?? "nexus").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  async function downloadDocumentation(format: "md" | "pdf") {
    if (!activeId) return;
    const doc = documentation ?? (await findApi.getDocumentation(activeId));
    const text = [doc.technical_markdown, doc.functional_markdown].filter(Boolean).join("\n\n---\n\n");
    if (format === "md") downloadTextFile(`${docFileBase}-documentation.md`, text);
    else downloadMarkdownAsPdf(`${docFileBase}-documentation.pdf`, "Technical & Functional Documentation", text);
  }

  async function downloadGlossary(format: "md" | "pdf") {
    if (!activeId) return;
    const g = glossary && !("unavailable" in glossary) ? glossary : await findApi.getGlossary(activeId);
    if ("unavailable" in g) { toast.error(g.reason); return; }
    const lines = ["# Business glossary", ""];
    for (const t of g.terms) lines.push(`- **${t.table}.${t.column}** — ${t.term}: ${t.definition}${t.isDerived ? ` _(derived: ${t.derivationLogic})_` : ""}`);
    if (g.synonym_groups.length) {
      lines.push("", "## Synonym groups", "");
      for (const sg of g.synonym_groups) lines.push(`- **${sg.standardizedTerm}**: ${sg.members.join(", ")}`);
    }
    const text = lines.join("\n");
    if (format === "md") downloadTextFile(`${docFileBase}-glossary.md`, text);
    else downloadMarkdownAsPdf(`${docFileBase}-glossary.pdf`, "Business Glossary", text);
  }

  const credentialConnector = connectors?.find((c) => c.id === credentialAction?.connectorId);

  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  function toggleExpanded(name: string) {
    setExpandedTables((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  }

  return (
    <div>
      <PageHeader
        phase="01 · Find"
        title="Schema & relationship intelligence"
        desc="Your database has the data. Nexus gives it back the logic — connect to a database your team already knows, crawl its schema, and get a business glossary, relationship map, and technical + functional documentation out the other end."
        action={
          <Dialog open={registerOpen} onOpenChange={(o) => { setRegisterOpen(o); if (!o) { setRegisterFields({}); setTestState("idle"); setTestMessage(""); setRegisterName(""); } }}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground" disabled={!connectors?.length}><Plus className="mr-2 h-4 w-4" /> Add a connection</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add a connection</DialogTitle>
                <DialogDescription>A live database your team has already chosen to expose, or a file export to try Nexus against before wiring up credentials at all — Find no longer scans for unknown sources.</DialogDescription>
              </DialogHeader>
              {connectors && connectors.length > 1 && (
                <div className="flex gap-2">
                  {connectors.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      size="sm"
                      variant={registerConnector?.id === c.id ? "default" : "outline"}
                      className={registerConnector?.id === c.id ? "bg-primary text-primary-foreground" : ""}
                      onClick={() => { setRegisterConnectorId(c.id); setRegisterFields({}); setTestState("idle"); setTestMessage(""); }}
                    >
                      {c.label}
                    </Button>
                  ))}
                </div>
              )}
              {registerConnector && (
                <div className="space-y-4">
                  <div><Label>Display name</Label><Input value={registerName} onChange={(e) => setRegisterName(e.target.value)} placeholder={registerConnector.category === "File" ? "FPI Sales Export" : "Oracle Fusion — Production"} /></div>
                  {registerConnector.fields.filter((f) => !f.hidden).map((f) => (
                    <div key={f.key}>
                      <Label>{f.label}</Label>
                      <FieldInput
                        field={f}
                        value={registerFields[f.key] ?? ""}
                        onChange={(key, val) => { setRegisterFields((prev) => ({ ...prev, [key]: val })); setTestState("idle"); setTestMessage(""); }}
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      {testState === "idle" && "Connection not tested yet"}
                      {testState === "testing" && "Testing connection…"}
                      {testState === "pass" && <span className="text-success">{testMessage}</span>}
                      {testState === "fail" && <span className="text-destructive">{testMessage}</span>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => testConnector.mutate()} disabled={testState === "testing"}>
                      {testState === "testing" ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null} Test connection
                    </Button>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => registerConnection.mutate()} disabled={registerConnection.isPending || !registerConnector}>Register</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="space-y-6 p-8">
        {/* Connections */}
        <div className="grid gap-3">
          {!connections?.length ? (
            <div className="rounded-xl border border-border bg-card-gradient p-10 text-center text-sm text-muted-foreground">
              No connections yet. Add the database your team wants Nexus to understand — or upload a file export to try it without a live connection.
            </div>
          ) : (
            connections.map((c) => {
              const Icon = iconFor(c.connector_id);
              const isActive = c.id === activeId;
              return (
                <div
                  key={c.id}
                  className={`rounded-xl border p-5 transition ${isActive ? "border-primary/60 bg-card-gradient shadow-glow" : "border-border bg-card-gradient hover:border-primary/40"}`}
                >
                  <div className="flex items-center gap-4">
                    <button className="flex flex-1 items-center gap-4 text-left" onClick={() => setActiveId(c.id)}>
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{c.name}</span>
                          <StatusBadge status={c.status} />
                        </div>
                        <div className="mt-1 font-mono text-xs text-muted-foreground">
                          {c.host ? <>{c.host}{c.port ? `:${c.port}` : ""}{c.service_name ? `/${c.service_name}` : ""} · {c.credential_label ?? "no credential on file"}</> : c.service_type}
                        </div>
                      </div>
                    </button>
                    <Button size="sm" variant="outline" onClick={() => openCredentialPrompt(c, { kind: "test" })}>
                      <ShieldCheck className="mr-2 h-3 w-3" /> Re-test
                    </Button>
                    <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => openCredentialPrompt(c, { kind: "crawl" })}>
                      <RefreshCw className="mr-2 h-3 w-3" /> Crawl schema
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteId(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Live crawl feed */}
        {(crawlPending || liveFeed.length > 0) && active && (
          <div className="rounded-xl border border-primary/20 bg-background/40 p-4 font-mono text-xs">
            {liveFeed.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-foreground/80">
                <span className="text-success">✓</span> {t.objectType.toLowerCase()} <span className="text-muted-foreground">{t.name}</span>
              </div>
            ))}
            {crawlPending && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> crawling {active.name}…</div>}
          </div>
        )}

        {/* Detail: schema / relationships / status fields / documentation */}
        {active && (
          <div className="rounded-xl border border-border bg-card-gradient p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Active connection</div>
                <h3 className="font-display text-lg font-semibold">{active.name}</h3>
              </div>
              {schema?.lastCrawledAt && (
                <div className="text-xs text-muted-foreground">Last crawled {new Date(schema.lastCrawledAt).toLocaleString()}</div>
              )}
            </div>

            {schema?.drift && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <div className="text-muted-foreground">
                  <span className="font-medium text-warning">Schema drift since the previous crawl</span> —
                  {schema.drift.addedTables.length > 0 && <> {schema.drift.addedTables.length} table{schema.drift.addedTables.length === 1 ? "" : "s"} added ({schema.drift.addedTables.join(", ")}).</>}
                  {schema.drift.removedTables.length > 0 && <> {schema.drift.removedTables.length} table{schema.drift.removedTables.length === 1 ? "" : "s"} removed ({schema.drift.removedTables.join(", ")}).</>}
                  {schema.drift.changedTables.length > 0 && (
                    <> {schema.drift.changedTables.map((c) => `${c.table} (${[...c.addedColumns.map((a) => `+${a}`), ...c.removedColumns.map((r) => `-${r}`)].join(", ")})`).join("; ")}.</>
                  )}
                  {" "}Regenerate documentation and the glossary to keep them in sync.
                </div>
              </div>
            )}

            {!schema?.tables.length ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No schema yet — click "Crawl schema" above to introspect this connection.</div>
            ) : (
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
                  <TabsTrigger value="schema"><Table2 className="mr-1.5 h-3.5 w-3.5" />Schema</TabsTrigger>
                  <TabsTrigger value="relationships"><Waypoints className="mr-1.5 h-3.5 w-3.5" />Relationships</TabsTrigger>
                  <TabsTrigger value="status"><Tags className="mr-1.5 h-3.5 w-3.5" />Status fields</TabsTrigger>
                  <TabsTrigger value="glossary"><BookOpen className="mr-1.5 h-3.5 w-3.5" />Glossary</TabsTrigger>
                  <TabsTrigger value="domain"><Brain className="mr-1.5 h-3.5 w-3.5" />Domain</TabsTrigger>
                  <TabsTrigger value="copilot"><Bot className="mr-1.5 h-3.5 w-3.5" />Copilot</TabsTrigger>
                  <TabsTrigger value="reports"><BarChart3 className="mr-1.5 h-3.5 w-3.5" />Reports</TabsTrigger>
                  <TabsTrigger value="documentation"><FileText className="mr-1.5 h-3.5 w-3.5" />Documentation</TabsTrigger>
                </TabsList>

                <TabsContent value="schema" className="space-y-2">
                  {schema.tables.map((t: TableDef) => {
                    const open = expandedTables.has(t.name);
                    return (
                      <Collapsible key={t.name} open={open} onOpenChange={() => toggleExpanded(t.name)}>
                        <div className="rounded-lg border border-border">
                          <CollapsibleTrigger asChild>
                            <button className="flex w-full items-center justify-between px-4 py-3 text-left">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-medium">{t.name}</span>
                                <Badge variant="outline" className="text-[10px]">{t.objectType}</Badge>
                                {(t.sensitivityLabels ?? []).map((l) => (
                                  <Badge key={l} variant="outline" className={`px-1.5 py-0 text-[10px] ${SENSITIVITY_STYLE[l] ?? ""}`}>{l}</Badge>
                                ))}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {t.rowEstimate != null && <span>{t.rowEstimate.toLocaleString()} rows (est.)</span>}
                                <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="border-t border-border px-4 py-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-muted-foreground">
                                  <th className="pb-1.5 pr-3 font-normal">Column</th>
                                  <th className="pb-1.5 pr-3 font-normal">Type</th>
                                  <th className="pb-1.5 pr-3 font-normal">Nullable</th>
                                  <th className="pb-1.5 font-normal">Key</th>
                                </tr>
                              </thead>
                              <tbody>
                                {t.columns.map((c) => {
                                  const isPk = t.primaryKey.includes(c.name);
                                  const fk = t.foreignKeys.find((f) => f.columns.includes(c.name));
                                  return (
                                    <tr key={c.name} className="border-t border-border/40">
                                      <td className="py-1 pr-3 font-mono">{c.name}</td>
                                      <td className="py-1 pr-3 font-mono text-muted-foreground">{c.dataType}</td>
                                      <td className="py-1 pr-3 text-muted-foreground">{c.nullable ? "yes" : "no"}</td>
                                      <td className="py-1">{isPk ? <Badge variant="outline" className="text-[10px]">PK</Badge> : fk ? <Badge variant="outline" className="text-[10px]">FK → {fk.refTable}</Badge> : ""}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </TabsContent>

                <TabsContent value="relationships" className="space-y-4">
                  {!schema.relationships.length ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">No foreign-key relationships found.</div>
                  ) : (
                    <>
                      <RelationshipDiagram
                        tables={schema.tables}
                        relationships={schema.relationships}
                        sensitivityByTable={Object.fromEntries(schema.tables.map((t) => [t.name, t.sensitivityLabels ?? []]))}
                        onSelectTable={jumpToCitation}
                      />
                      <div className="space-y-2">
                        {schema.relationships.map((r, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg bg-secondary/30 px-4 py-2.5 font-mono text-xs">
                            <Waypoints className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span>{r.fromTable}({r.fromColumns.join(", ")})</span>
                            <span className="text-muted-foreground">→</span>
                            <span>{r.toTable}({r.toColumns.join(", ")})</span>
                            <span className="ml-auto text-muted-foreground">{r.constraintName}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="status" className="space-y-2">
                  {!schema.statusFields.length ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">No status/enum-like columns detected.</div>
                  ) : schema.statusFields.map((s, i) => (
                    <div key={i} className="rounded-lg bg-secondary/30 px-4 py-2.5 text-xs">
                      <div className="font-mono font-medium">{s.table}.{s.column}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {s.candidateValues ? s.candidateValues.map((v) => (
                          <Badge key={v} variant="outline" className="font-mono text-[10px]">{v}</Badge>
                        )) : <span className="text-muted-foreground">flagged by name — values unconfirmed</span>}
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">{s.source === "check_constraint" ? "from CHECK constraint" : "name heuristic"}</span>
                      </div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="glossary" className="space-y-4">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
                    Your database has the data. Nexus gives it back the logic — what a column is for versus what it's named, which fields are derived rather than stored, and which differently-named columns across tables mean the same thing.
                  </div>
                  {glossaryLoading ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">Reconstructing the glossary…</div>
                  ) : !glossary || "unavailable" in glossary ? (
                    <div className="space-y-3 p-6 text-center text-sm text-muted-foreground">
                      <div>{glossary && "reason" in glossary ? glossary.reason : "No glossary yet."}</div>
                      <Button size="sm" variant="outline" onClick={() => regenerateGlossary.mutate()} disabled={regenerateGlossary.isPending}>
                        {regenerateGlossary.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <BookOpen className="mr-2 h-3 w-3" />} Generate glossary
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                        <p className="text-sm text-foreground">
                          We explained <strong>{glossary.terms.length}</strong> column{glossary.terms.length === 1 ? "" : "s"} in plain English
                          {glossary.synonym_groups.length > 0 && <>, found <strong>{glossary.synonym_groups.length}</strong> pair{glossary.synonym_groups.length === 1 ? "" : "s"} that mean the same thing</>}
                          {schema && schema.unconstrainedReferences.length > 0 && <>, and flagged <strong>{schema.unconstrainedReferences.length}</strong> possible missing link{schema.unconstrainedReferences.length === 1 ? "" : "s"}</>}.
                        </p>
                        {glossary.stale && (
                          <Badge variant="outline" className="mt-2 border-warning/40 text-warning"><AlertTriangle className="mr-1 h-3 w-3" /> Stale — schema re-crawled since this was generated</Badge>
                        )}
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => downloadGlossary("md")}><Download className="mr-2 h-3 w-3" /> Markdown</Button>
                        <Button size="sm" variant="outline" onClick={() => downloadGlossary("pdf")}><Download className="mr-2 h-3 w-3" /> PDF</Button>
                        <Button size="sm" variant="outline" onClick={() => regenerateGlossary.mutate()} disabled={regenerateGlossary.isPending}>
                          {regenerateGlossary.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />} Regenerate
                        </Button>
                      </div>

                      {!glossary.terms.length ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">No business-meaningful columns identified.</div>
                      ) : (
                        <div className="space-y-1.5">
                          {glossary.terms.map((t, i) => (
                            <div key={i} className="rounded-lg bg-secondary/30 px-4 py-2.5 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono font-medium">{t.table}.{t.column}</span>
                                <Badge variant="outline" className="border-primary/40 text-[10px] text-primary">{t.term}</Badge>
                                {t.isDerived && <Badge variant="outline" className="border-warning/40 text-[10px] text-warning">Calculated, not typed in</Badge>}
                              </div>
                              <div className="mt-1 text-muted-foreground">{t.definition}</div>
                              {t.isDerived && t.derivationLogic && <div className="mt-1 font-mono text-[11px] text-muted-foreground">= {t.derivationLogic}</div>}
                            </div>
                          ))}
                        </div>
                      )}

                      {glossary.synonym_groups.length > 0 && (
                        <div>
                          <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Same thing, different names</div>
                          <p className="mb-2 text-xs text-muted-foreground">If you ever rename one of these, rename the other too — they're tracking the same value.</p>
                          <div className="space-y-1.5">
                            {glossary.synonym_groups.map((sg, i) => (
                              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary/30 px-4 py-2.5 text-xs">
                                <Badge variant="outline" className="border-primary/40 text-primary">{sg.standardizedTerm}</Badge>
                                <span className="text-muted-foreground">=</span>
                                {sg.members.map((m) => <span key={m} className="font-mono">{m}</span>)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {schema && schema.unconstrainedReferences.length > 0 && (
                        <div>
                          <div className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"><Link2Off className="h-3.5 w-3.5" /> Possible missing links</div>
                          <p className="mb-2 text-xs text-muted-foreground">These columns look like they should point at another table, but nothing enforces it — worth double-checking nothing referenced here was deleted by mistake.</p>
                          <div className="space-y-1.5">
                            {schema.unconstrainedReferences.map((r, i) => (
                              <div key={i} className="rounded-lg bg-secondary/30 px-4 py-2.5 font-mono text-xs">
                                <span>{r.table}.{r.column}</span> <span className="text-muted-foreground">looks like a reference to</span> <span>{r.likelyTargetTable}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="domain" className="space-y-4">
                  {domainLoading ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">Classifying domain…</div>
                  ) : !domain || "unavailable" in domain ? (
                    <div className="space-y-3 p-6 text-center text-sm text-muted-foreground">
                      <div>{domain && "reason" in domain ? domain.reason : "No classification yet."}</div>
                      <Button size="sm" variant="outline" onClick={() => regenerateDomain.mutate()} disabled={regenerateDomain.isPending}>
                        {regenerateDomain.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Brain className="mr-2 h-3 w-3" />} Classify domain
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-xs uppercase tracking-wider text-muted-foreground">This looks like</div>
                            <div className="mt-1 font-display text-2xl font-bold capitalize sm:text-3xl">{domain.domain.replace(/_/g, " ")}</div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => regenerateDomain.mutate()} disabled={regenerateDomain.isPending}>
                            {regenerateDomain.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />} Regenerate
                          </Button>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <div className="h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-secondary/40">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(domain.confidence * 100)}%` }} />
                          </div>
                          <span className="text-xs font-medium text-primary">{confidenceLabel(domain.confidence)}</span>
                        </div>
                        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{domain.rationale}</p>
                      </div>

                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-muted-foreground">
                            Show technical detail <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-border p-4">
                            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Per-table tags</div>
                            <div className="space-y-1.5">
                              {Object.entries(domain.table_domains).map(([table, tag]) => (
                                <div key={table} className="flex items-center justify-between font-mono text-xs">
                                  <span>{table}</span>
                                  <Badge variant="outline" className={/system/i.test(tag) ? "text-muted-foreground" : "border-primary/40 text-primary"}>{tag}</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-lg border border-border p-4">
                            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Signals</div>
                            <div className="space-y-2 text-xs">
                              <div><span className="text-muted-foreground">Tables: </span>{domain.signals.tables.join(", ") || "—"}</div>
                              <div><span className="text-muted-foreground">Columns: </span>{domain.signals.columns.join(", ") || "—"}</div>
                              {domain.signals.values.map((v, i) => <div key={i} className="text-muted-foreground">{v}</div>)}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="copilot" className="space-y-4">
                  <div className="rounded-xl border border-border p-5">
                    <div className="mb-1 flex items-center gap-2">
                      <h4 className="font-medium">Ask Nexus</h4>
                      <Badge variant="outline" className="border-primary/40 text-[10px] text-primary">Schema-grounded</Badge>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Ask what a table, column, or relationship means. The copilot answers only from the crawled schema, glossary, and documentation — it never invents a number, and points you to Reports for anything that needs a real query.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={copilotQuestion}
                        onChange={(e) => setCopilotQuestion(e.target.value)}
                        placeholder="e.g. what does the status column on properties mean?"
                        onKeyDown={(e) => e.key === "Enter" && copilotQuestion.trim() && activeId && askCopilot.mutate({ id: activeId, question: copilotQuestion })}
                      />
                      <Button
                        disabled={!copilotQuestion.trim() || askCopilot.isPending}
                        onClick={() => activeId && askCopilot.mutate({ id: activeId, question: copilotQuestion })}
                      >
                        {askCopilot.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />} Ask
                      </Button>
                    </div>
                    {copilotAnswer && (
                      <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
                        <div className="prose prose-invert prose-sm max-w-none [&_table]:w-full [&_th]:text-left [&_code]:font-mono">
                          <ReactMarkdown>{copilotAnswer.answer}</ReactMarkdown>
                        </div>
                        {copilotAnswer.citations.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-primary/20 pt-3">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Sources</span>
                            {copilotAnswer.citations.map((c, i) => (
                              <button
                                key={i}
                                title={c.note}
                                onClick={() => jumpToCitation(c.ref)}
                                className="rounded-full border border-primary/30 bg-background px-2 py-0.5 font-mono text-[10px] text-primary hover:bg-primary/10"
                              >
                                {c.ref}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border p-5">
                    <h4 className="mb-1 font-medium">Show &amp; download</h4>
                    <p className="mb-3 text-xs text-muted-foreground">Pull the latest generated documentation and glossary for this connection without switching tabs.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => downloadDocumentation("md")}><Download className="mr-2 h-3 w-3" /> Documentation (.md)</Button>
                      <Button size="sm" variant="outline" onClick={() => downloadDocumentation("pdf")}><Download className="mr-2 h-3 w-3" /> Documentation (.pdf)</Button>
                      <Button size="sm" variant="outline" onClick={() => downloadGlossary("md")}><Download className="mr-2 h-3 w-3" /> Glossary (.md)</Button>
                      <Button size="sm" variant="outline" onClick={() => downloadGlossary("pdf")}><Download className="mr-2 h-3 w-3" /> Glossary (.pdf)</Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="reports" className="space-y-4">
                  <div className="rounded-xl border border-border p-5">
                    <div className="mb-1 flex items-center gap-2">
                      <h4 className="font-medium">Build a report</h4>
                      <Badge variant="outline" className="border-primary/40 text-[10px] text-primary">click, don't type</Badge>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">Pick a table, then click the columns to group and measure by — no typing required.</p>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {schema?.tables.map((t) => (
                        <button
                          key={t.name}
                          onClick={() => { setBuilderTable(t.name); setBuilderGroupBy(null); setBuilderMeasure(null); }}
                          className={`rounded-full border px-3 py-1 font-mono text-xs ${builderTable === t.name ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                    {builderTable && (() => {
                      const table = schema?.tables.find((t) => t.name === builderTable);
                      if (!table) return null;
                      const groupCols = table.columns.filter((c) => STRING_TYPE_RE.test(c.dataType));
                      const measureCols = table.columns.filter((c) => NUMERIC_TYPE_RE.test(c.dataType) && !table.primaryKey.includes(c.name));
                      return (
                        <div className="space-y-3 rounded-lg bg-secondary/30 p-3">
                          <div>
                            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Group by</div>
                            <div className="flex flex-wrap gap-1.5">
                              {groupCols.length === 0 && <span className="text-xs text-muted-foreground">No text columns on this table.</span>}
                              {groupCols.map((c) => (
                                <button
                                  key={c.name}
                                  onClick={() => setBuilderGroupBy(builderGroupBy === c.name ? null : c.name)}
                                  className={`rounded-full border px-3 py-1 font-mono text-xs ${builderGroupBy === c.name ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                                >
                                  {c.name}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Measure (optional — leave blank to count rows)</div>
                            <div className="flex flex-wrap gap-1.5">
                              {measureCols.length === 0 && <span className="text-xs text-muted-foreground">No numeric columns on this table.</span>}
                              {measureCols.map((c) => (
                                <button
                                  key={c.name}
                                  onClick={() => { const next = builderMeasure === c.name ? null : c.name; setBuilderMeasure(next); setBuilderAgg(next ? "sum" : "count"); }}
                                  className={`rounded-full border px-3 py-1 font-mono text-xs ${builderMeasure === c.name ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                                >
                                  {c.name}
                                </button>
                              ))}
                            </div>
                          </div>
                          {builderMeasure && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Aggregate</span>
                              {(["sum", "avg"] as const).map((agg) => (
                                <button
                                  key={agg}
                                  onClick={() => setBuilderAgg(agg)}
                                  className={`rounded-full border px-2.5 py-0.5 text-xs ${builderAgg === agg ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                                >
                                  {agg === "sum" ? "Total" : "Average"}
                                </button>
                              ))}
                            </div>
                          )}
                          <Button
                            size="sm"
                            disabled={!builderGroupBy}
                            onClick={() => {
                              if (!active || !builderGroupBy) return;
                              const agg = builderMeasure ? builderAgg : "count";
                              const text = agg === "count"
                                ? `count of ${builderTable} grouped by ${builderTable}.${builderGroupBy}`
                                : `${agg === "sum" ? "total" : "average"} ${builderTable}.${builderMeasure} grouped by ${builderTable}.${builderGroupBy}`;
                              setCustomText(text);
                              openCredentialPrompt(active, { kind: "custom", text });
                            }}
                          >
                            <Play className="mr-2 h-3 w-3" /> Run this report
                          </Button>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="rounded-xl border border-border p-5">
                    <div className="mb-1 flex items-center gap-2">
                      <h4 className="font-medium">Ask for a report</h4>
                      <Badge variant="outline" className="border-primary/40 text-[10px] text-primary">AI-parsed</Badge>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">Describe what you want in plain language — every field is checked against the real schema before any SQL runs.</p>
                    <div className="flex gap-2">
                      <Input
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        placeholder="e.g. active properties by city"
                        onKeyDown={(e) => e.key === "Enter" && customText.trim() && active && openCredentialPrompt(active, { kind: "custom", text: customText })}
                      />
                      <Button
                        disabled={!customText.trim()}
                        onClick={() => active && openCredentialPrompt(active, { kind: "custom", text: customText })}
                      >
                        <Send className="mr-2 h-3.5 w-3.5" /> Generate
                      </Button>
                    </div>
                    {customOutcome && <div className="mt-4"><ReportResultView outcome={customOutcome} filename={`${docFileBase}-custom-report`} /></div>}
                  </div>

                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Suggested reports</div>
                  {!reportSuggestions?.length ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">No report candidates found for this schema yet.</div>
                  ) : (
                    reportSuggestions.map((t) => (
                      <div key={t.id} className="rounded-xl border border-border p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{t.name}</div>
                            <div className="text-xs text-muted-foreground">{t.description}</div>
                          </div>
                          <Button size="sm" onClick={() => active && openCredentialPrompt(active, { kind: "run", template: t })}>
                            <Play className="mr-2 h-3 w-3" /> Run
                          </Button>
                        </div>
                        {reportOutcomes[t.id] && <div className="mt-4"><ReportResultView outcome={reportOutcomes[t.id]} filename={`${docFileBase}-${t.id}`} /></div>}
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="documentation" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {documentation ? `Generated ${new Date(documentation.generated_at).toLocaleString()}` : ""}
                      {documentation?.stale && (
                        <Badge variant="outline" className="border-warning/40 text-warning"><AlertTriangle className="mr-1 h-3 w-3" /> Stale — schema re-crawled since this was generated</Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => downloadDocumentation("md")}><Download className="mr-2 h-3 w-3" /> Markdown</Button>
                      <Button size="sm" variant="outline" onClick={() => downloadDocumentation("pdf")}><Download className="mr-2 h-3 w-3" /> PDF</Button>
                      <Button size="sm" variant="outline" onClick={() => regenerateDocs.mutate()} disabled={regenerateDocs.isPending}>
                        {regenerateDocs.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />} Regenerate
                      </Button>
                    </div>
                  </div>
                  {docLoading ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">Generating documentation…</div>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {/* Functional documentation — the AI-written plain-English narrative */}
                      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 p-5">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                            <Sparkles className="h-3.5 w-3.5" /> Functional documentation
                          </div>
                          <Badge variant="outline" className="border-primary/40 text-[10px] text-primary">AI-generated</Badge>
                        </div>
                        {documentation?.functional_markdown ? (
                          <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown>{documentation.functional_markdown}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            This connection has <strong>{schema?.tables.length ?? 0} tables</strong> and <strong>{schema?.relationships.length ?? 0} relationships</strong> between them.
                            {" "}Set <code className="rounded bg-muted px-1 py-0.5 text-xs">ANTHROPIC_API_KEY</code> on find-service for a full plain-English write-up here — the technical detail alongside still works without it.
                          </p>
                        )}
                      </div>

                      {/* Technical documentation — structured, at-a-glance per-table cards instead of a raw markdown dump */}
                      <div className="rounded-xl border border-border bg-card p-5">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <FileText className="h-3.5 w-3.5" /> Technical documentation
                          </div>
                          <Badge variant="outline" className="text-[10px]">{schema?.tables.length ?? 0} objects</Badge>
                        </div>
                        <div className="grid max-h-[360px] gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
                          {(schema?.tables ?? []).map((t) => {
                            const statusCount = (schema?.statusFields ?? []).filter((s) => s.table === t.name).length;
                            return (
                              <div key={t.name} className="rounded-lg border border-border/60 bg-secondary/20 p-3">
                                <div className="flex items-center gap-1.5">
                                  <Table2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <span className="truncate font-mono text-xs font-semibold">{t.name}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1">
                                  <Badge variant="outline" className="text-[10px]">{t.columns.length} cols</Badge>
                                  {t.primaryKey.length > 0 && (
                                    <Badge variant="outline" className="gap-0.5 text-[10px]"><KeyRound className="h-2.5 w-2.5" />{t.primaryKey.length} PK</Badge>
                                  )}
                                  {t.foreignKeys.length > 0 && (
                                    <Badge variant="outline" className="gap-0.5 text-[10px]"><Link2 className="h-2.5 w-2.5" />{t.foreignKeys.length} FK</Badge>
                                  )}
                                  {statusCount > 0 && (
                                    <Badge variant="outline" className="gap-0.5 text-[10px]"><Tags className="h-2.5 w-2.5" />{statusCount} status</Badge>
                                  )}
                                  {(t.sensitivityLabels ?? []).map((l) => (
                                    <Badge key={l} variant="outline" className={`px-1.5 py-0 text-[10px] ${SENSITIVITY_STYLE[l] ?? ""}`}>{l}</Badge>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {!!schema?.relationships.length && (
                          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                            {schema.relationships.map((r, i) => (
                              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-secondary/40 px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                                <Waypoints className="h-3 w-3 text-primary/70" /> {r.fromTable} → {r.toTable}
                              </span>
                            ))}
                          </div>
                        )}
                        <Collapsible className="mt-3">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
                              Show raw technical Markdown <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2">
                            <div className="prose prose-invert prose-sm max-w-none rounded-lg border border-border bg-background/40 p-4 [&_table]:w-full [&_th]:text-left [&_code]:font-mono">
                              <ReactMarkdown>{documentation?.technical_markdown ?? ""}</ReactMarkdown>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </div>

      {/* Credential prompt for re-test / crawl / report run (password is never persisted) */}
      <Dialog open={!!credentialAction} onOpenChange={(o) => !o && setCredentialAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {credentialAction?.kind === "crawl" && "Crawl schema"}
              {credentialAction?.kind === "test" && "Re-test connection"}
              {credentialAction?.kind === "run" && `Run "${credentialAction.template.name}"`}
              {credentialAction?.kind === "custom" && "Run custom report"}
            </DialogTitle>
            <DialogDescription>
              {credentialConnector?.category === "File" ? "Nothing is stored server-side — choose the file again to proceed." : "Credentials aren't stored — confirm them to proceed."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {credentialAction?.kind === "custom" && (
              <div className="rounded-lg bg-secondary/30 px-3 py-2 text-xs italic text-muted-foreground">"{credentialAction.text}"</div>
            )}
            {credentialConnector?.fields.filter((f) => !f.hidden).map((f) => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <FieldInput field={f} value={credentialFields[f.key] ?? ""} onChange={(key, val) => setCredentialFields((prev) => ({ ...prev, [key]: val }))} />
              </div>
            ))}
            {credentialAction?.kind === "run" && credentialAction.template.filters.map((f) => (
              f.type === "categorical" ? (
                <div key={f.name}>
                  <Label className="capitalize">{f.name.replace(/_/g, " ")}</Label>
                  <Input
                    placeholder="leave blank for no filter"
                    value={filterValues[f.name] ?? ""}
                    onChange={(e) => setFilterValues({ ...filterValues, [f.name]: e.target.value })}
                  />
                </div>
              ) : (
                <div key={f.name} className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="capitalize">{f.name.replace(/_/g, " ")} since</Label>
                    <Input type="date" value={filterValues[`${f.name}_since`] ?? ""} onChange={(e) => setFilterValues({ ...filterValues, [`${f.name}_since`]: e.target.value })} />
                  </div>
                  <div>
                    <Label className="capitalize">{f.name.replace(/_/g, " ")} until</Label>
                    <Input type="date" value={filterValues[`${f.name}_until`] ?? ""} onChange={(e) => setFilterValues({ ...filterValues, [`${f.name}_until`]: e.target.value })} />
                  </div>
                </div>
              )
            ))}
          </div>
          <DialogFooter>
            <Button onClick={submitCredentialPrompt} disabled={credentialPending}>
              {credentialPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Plug className="mr-2 h-3 w-3" />}
              {credentialAction?.kind === "crawl" && "Start crawl"}
              {credentialAction?.kind === "test" && "Test"}
              {(credentialAction?.kind === "run" || credentialAction?.kind === "custom") && "Run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this connection?</AlertDialogTitle>
            <AlertDialogDescription>Its crawled schema and documentation stay on record, but the connection itself is removed. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteConnection.mutate(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
