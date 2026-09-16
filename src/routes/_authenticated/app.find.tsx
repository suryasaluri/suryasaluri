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
  FileText, Sparkles, Plug, ShieldCheck,
} from "lucide-react";
import { iconFor, SENSITIVITY_STYLE } from "@/lib/connectors";
import { findApi, streamCrawl, type ConnectionRecord, type TableDef } from "@/lib/findApiClient";

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

/** The credential fields a fresh test/crawl needs — password is never stored, so every re-test or crawl asks for it again. */
type CredentialAction = { connectionId: string; kind: "test" | "crawl" };

function FindPage() {
  const qc = useQueryClient();

  const { data: connectors } = useQuery({ queryKey: ["connectors"], queryFn: findApi.getConnectors });
  const connector = connectors?.[0];

  const { data: connections } = useQuery({ queryKey: ["connections"], queryFn: findApi.listConnections });
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    if (!activeId && connections?.length) setActiveId(connections[0].id);
  }, [connections, activeId]);
  const active = connections?.find((c) => c.id === activeId) ?? null;

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
      return findApi.testConnector(connector!.id, registerFields);
    },
    onSuccess: (result) => { setTestState(result.ok ? "pass" : "fail"); setTestMessage(result.message); },
    onError: (e: unknown) => { setTestState("fail"); setTestMessage(errMsg(e)); },
  });

  const registerConnection = useMutation({
    mutationFn: () => findApi.registerConnection({ name: registerName, connectorId: connector!.id, fields: registerFields }),
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

  // --- re-test / crawl credential prompt (password is never persisted) ---
  const [credentialAction, setCredentialAction] = useState<CredentialAction | null>(null);
  const [credentialFields, setCredentialFields] = useState<Record<string, string>>({});

  function openCredentialPrompt(conn: ConnectionRecord, kind: "test" | "crawl") {
    setCredentialAction({ connectionId: conn.id, kind });
    setCredentialFields({
      host: conn.host ?? "", port: conn.port ? String(conn.port) : "", serviceName: conn.service_name ?? "",
      username: conn.username ?? "", password: "",
    });
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

  function submitCredentialPrompt() {
    if (!credentialAction) return;
    if (credentialAction.kind === "test") retest.mutate({ id: credentialAction.connectionId, fields: credentialFields });
    else crawl.mutate({ id: credentialAction.connectionId, fields: credentialFields });
  }

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
        desc="Connect to a database your team already knows, crawl its schema, and get technical + functional documentation out the other end."
        action={
          <Dialog open={registerOpen} onOpenChange={(o) => { setRegisterOpen(o); if (!o) { setRegisterFields({}); setTestState("idle"); setTestMessage(""); setRegisterName(""); } }}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground" disabled={!connector}><Plus className="mr-2 h-4 w-4" /> Register Oracle connection</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Register Oracle connection</DialogTitle>
                <DialogDescription>Use the connection details for a database your team has already chosen to expose — Find no longer scans for unknown sources.</DialogDescription>
              </DialogHeader>
              {connector && (
                <div className="space-y-4">
                  <div><Label>Display name</Label><Input value={registerName} onChange={(e) => setRegisterName(e.target.value)} placeholder="Oracle Fusion — Production" /></div>
                  {connector.fields.map((f) => (
                    <div key={f.key}>
                      <Label>{f.label}</Label>
                      <Input
                        type={f.type === "number" ? "number" : f.type}
                        value={registerFields[f.key] ?? ""}
                        onChange={(e) => { setRegisterFields({ ...registerFields, [f.key]: e.target.value }); setTestState("idle"); setTestMessage(""); }}
                        placeholder={f.placeholder ?? (f.key === "port" ? String(connector.defaultPort ?? "") : undefined)}
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
                <Button onClick={() => registerConnection.mutate()} disabled={registerConnection.isPending || !connector}>Register</Button>
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
              No connections yet. Register the Oracle database your team wants Nexus to understand.
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
                          {c.host}{c.port ? `:${c.port}` : ""}{c.service_name ? `/${c.service_name}` : ""} · {c.credential_label ?? "no credential on file"}
                        </div>
                      </div>
                    </button>
                    <Button size="sm" variant="outline" onClick={() => openCredentialPrompt(c, "test")}>
                      <ShieldCheck className="mr-2 h-3 w-3" /> Re-test
                    </Button>
                    <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => openCredentialPrompt(c, "crawl")}>
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

            {!schema?.tables.length ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No schema yet — click "Crawl schema" above to introspect this connection.</div>
            ) : (
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="schema"><Table2 className="mr-1.5 h-3.5 w-3.5" />Schema</TabsTrigger>
                  <TabsTrigger value="relationships"><Waypoints className="mr-1.5 h-3.5 w-3.5" />Relationships</TabsTrigger>
                  <TabsTrigger value="status"><Tags className="mr-1.5 h-3.5 w-3.5" />Status fields</TabsTrigger>
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

                <TabsContent value="relationships" className="space-y-2">
                  {!schema.relationships.length ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">No foreign-key relationships found.</div>
                  ) : schema.relationships.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-secondary/30 px-4 py-2.5 font-mono text-xs">
                      <Waypoints className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{r.fromTable}({r.fromColumns.join(", ")})</span>
                      <span className="text-muted-foreground">→</span>
                      <span>{r.toTable}({r.toColumns.join(", ")})</span>
                      <span className="ml-auto text-muted-foreground">{r.constraintName}</span>
                    </div>
                  ))}
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

                <TabsContent value="documentation" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">{documentation ? `Generated ${new Date(documentation.generated_at).toLocaleString()}` : ""}</div>
                    <Button size="sm" variant="outline" onClick={() => regenerateDocs.mutate()} disabled={regenerateDocs.isPending}>
                      {regenerateDocs.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />} Regenerate
                    </Button>
                  </div>
                  {docLoading ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">Generating documentation…</div>
                  ) : (
                    <>
                      <div className="prose prose-invert prose-sm max-w-none rounded-lg border border-border bg-background/40 p-4 [&_table]:w-full [&_th]:text-left [&_code]:font-mono">
                        <ReactMarkdown>{documentation?.technical_markdown ?? ""}</ReactMarkdown>
                      </div>
                      {documentation?.functional_markdown && (
                        <div>
                          <div className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-primary"><Sparkles className="h-3.5 w-3.5" /> AI functional narrative</div>
                          <div className="prose prose-invert prose-sm max-w-none rounded-lg border border-primary/30 bg-primary/5 p-4">
                            <ReactMarkdown>{documentation.functional_markdown}</ReactMarkdown>
                          </div>
                        </div>
                      )}
                      {!documentation?.functional_markdown && (
                        <div className="text-xs text-muted-foreground">No AI functional narrative — set <code className="rounded bg-muted px-1 py-0.5">ANTHROPIC_API_KEY</code> on find-service to enable it.</div>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </div>

      {/* Credential prompt for re-test / crawl (password is never persisted) */}
      <Dialog open={!!credentialAction} onOpenChange={(o) => !o && setCredentialAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{credentialAction?.kind === "crawl" ? "Crawl schema" : "Re-test connection"}</DialogTitle>
            <DialogDescription>Credentials aren't stored — confirm them to {credentialAction?.kind === "crawl" ? "start this crawl" : "re-test this connection"}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {connector?.fields.map((f) => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <Input
                  type={f.type === "number" ? "number" : f.type}
                  value={credentialFields[f.key] ?? ""}
                  onChange={(e) => setCredentialFields({ ...credentialFields, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={submitCredentialPrompt} disabled={retest.isPending || crawlPending}>
              {(retest.isPending || crawlPending) ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Plug className="mr-2 h-3 w-3" />}
              {credentialAction?.kind === "crawl" ? "Start crawl" : "Test"}
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
