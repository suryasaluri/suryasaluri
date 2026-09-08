import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search, Radar, Lock, Plug, Unplug, ShieldCheck, ChevronDown, History,
  Trash2, Plus, Loader2, X,
} from "lucide-react";
import {
  CONNECTOR_CATALOG, CATEGORIES, iconFor, classifySensitivity, SENSITIVITY_STYLE,
  mockSchemaPreview, type Connector, type ConnectorCategory,
} from "@/lib/connectors";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/app/find")({
  component: FindPage,
});

type DataSource = Tables<"data_sources">;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: "Open · Ready", cls: "bg-success/15 text-success border-success/30" },
  connected: { label: "Connected", cls: "bg-primary/15 text-primary border-primary/30" },
  auth_required: { label: "Auth required", cls: "bg-warning/15 text-warning border-warning/30" },
  blocked: { label: "Firewalled", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  discovered: { label: "Discovered", cls: "bg-muted text-muted-foreground border-border" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

function labels(json: unknown): string[] {
  return Array.isArray(json) ? (json as string[]) : [];
}

function SensitivityBadges({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((l) => (
        <Badge key={l} variant="outline" className={`px-1.5 py-0 text-[10px] ${SENSITIVITY_STYLE[l] ?? ""}`}>{l}</Badge>
      ))}
    </div>
  );
}

const SCAN_TYPES: { id: string; label: string; placeholder: string; categories: ConnectorCategory[] }[] = [
  { id: "network", label: "Network subnet scan", placeholder: "10.0.0.0/24", categories: ["Database", "Streaming"] },
  { id: "cloud", label: "Cloud account scan", placeholder: "aws:prod-114", categories: ["Warehouse", "Storage"] },
  { id: "saas", label: "SaaS OAuth sweep", placeholder: "workspace.company.com", categories: ["SaaS"] },
];

const OPEN_STATUS_POOL = ["open", "open", "open", "auth_required", "blocked"];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

function randomOf<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildCandidate(connector: Connector) {
  const needsAuth = connector.fields.some((f) => f.type === "password");
  const status = needsAuth ? randomOf(["auth_required", "open", "blocked"]) : randomOf(OPEN_STATUS_POOL);
  const blocked = status === "blocked";
  const name = `${connector.label} ${randomOf(["Prod", "Analytics", "Core", "Warehouse", "Reporting", "Ops"])}`;
  const sensitivity = classifySensitivity({ name, service_type: connector.label, category: connector.category });
  return {
    name,
    service_type: connector.label,
    host: connector.id === "bigquery" ? `project-${Math.floor(1000 + Math.random() * 9000)}` : `${connector.id}.internal`,
    port: connector.defaultPort ?? null,
    status,
    connector_type: connector.connectorType,
    table_count: blocked ? 0 : Math.floor(10 + Math.random() * 240),
    row_count: blocked ? 0 : Math.floor(50_000 + Math.random() * 90_000_000),
    difficulty_score: blocked ? 4 : needsAuth ? 2 : 1,
    category: connector.category,
    tags: [] as string[],
    sensitivity_labels: sensitivity,
    schema_metadata: {},
    credential_label: null as string | null,
    connected_at: null as string | null,
    notes: null as string | null,
  };
}

function primaryAction(status: string): { label: string; action: "connect" | "authenticate" | "firewall_request" | "disconnect"; icon: typeof Plug } | null {
  if (status === "blocked") return { label: "Firewall request", action: "firewall_request", icon: Lock };
  if (status === "auth_required") return { label: "Authenticate", action: "authenticate", icon: ShieldCheck };
  if (status === "open" || status === "discovered") return { label: "Connect", action: "connect", icon: Plug };
  if (status === "connected") return { label: "Disconnect", action: "disconnect", icon: Unplug };
  return null;
}

function FindPage() {
  const { data: org } = useOrg();
  const qc = useQueryClient();

  // Scan panel state
  const [scanType, setScanType] = useState(SCAN_TYPES[0].id);
  const [target, setTarget] = useState(SCAN_TYPES[0].placeholder);
  const [liveFeed, setLiveFeed] = useState<ReturnType<typeof buildCandidate>[]>([]);
  const [scanning, setScanning] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Add-source dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [connectorId, setConnectorId] = useState(CONNECTOR_CATALOG[0].id);
  const [addName, setAddName] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [testState, setTestState] = useState<"idle" | "testing" | "pass" | "fail">("idle");
  const connector = CONNECTOR_CATALOG.find((c) => c.id === connectorId)!;

  // List toolbar state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Detail sheet state
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: sources } = useQuery({
    queryKey: ["sources", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("data_sources").select("*").eq("org_id", org!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: scans } = useQuery({
    queryKey: ["scans", org?.id],
    enabled: !!org?.id,
    queryFn: async () => (await supabase.from("discovery_scans").select("*").eq("org_id", org!.id).order("created_at", { ascending: false }).limit(8)).data ?? [],
  });

  const detailSource = sources?.find((s) => s.id === detailId) ?? null;

  const { data: sourceAudit } = useQuery({
    queryKey: ["source-audit", detailId],
    enabled: !!detailId,
    queryFn: async () => (await supabase.from("audit_logs").select("*").eq("resource_id", detailId!).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const scan = useMutation({
    mutationFn: async () => {
      if (!org) return { found: 0 };
      const scope = SCAN_TYPES.find((s) => s.id === scanType)!;
      const existingTypes = new Set((sources ?? []).map((s) => s.service_type));
      const pool = CONNECTOR_CATALOG.filter((c) => scope.categories.includes(c.category) && !existingTypes.has(c.label));
      if (pool.length === 0) return { found: 0 };

      const { data: scanRow, error: scanErr } = await supabase.from("discovery_scans").insert({
        org_id: org.id, scan_type: scanType, target, status: "running",
      }).select().single();
      if (scanErr) throw scanErr;

      const count = Math.min(pool.length, 2 + Math.floor(Math.random() * 3));
      const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
      const candidates = shuffled.map(buildCandidate);

      setScanning(true);
      setLiveFeed([]);
      for (const c of candidates) {
        await sleep(600 + Math.random() * 300);
        setLiveFeed((f) => [...f, c]);
      }
      await sleep(400);

      const { error: insertErr } = await supabase.from("data_sources").insert(candidates.map((c) => ({ ...c, org_id: org.id })));
      if (insertErr) throw insertErr;

      await supabase.from("discovery_scans").update({
        status: "completed", completed_at: new Date().toISOString(), sources_found: candidates.length,
      }).eq("id", scanRow.id);

      await supabase.from("audit_logs").insert({
        org_id: org.id, action: "scan.completed", resource_type: "discovery_scan", resource_id: scanRow.id,
        details: { scan_type: scanType, target, sources_found: candidates.length },
      });

      return { found: candidates.length };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["sources"] });
      qc.invalidateQueries({ queryKey: ["scans"] });
      setScanning(false);
      setTimeout(() => setLiveFeed([]), 2500);
      if (res?.found) toast.success(`Scan complete — ${res.found} new source${res.found > 1 ? "s" : ""} found`);
      else toast.info("Scan complete — no new sources in this scope");
    },
    onError: (e: unknown) => { setScanning(false); toast.error(errMsg(e)); },
  });

  const testConnection = useMutation({
    mutationFn: async (): Promise<"pass" | "fail"> => {
      setTestState("testing");
      await sleep(1000 + Math.random() * 700);
      const required = connector.fields.filter((f) => f.type !== "number");
      const filled = required.every((f) => (fieldValues[f.key] ?? "").trim().length > 0);
      if (!filled) return "fail";
      return Math.random() < 0.88 ? "pass" : "fail";
    },
    onSuccess: (r) => setTestState(r),
  });

  const addSource = useMutation({
    mutationFn: async () => {
      if (!org) return;
      const name = addName.trim() || `${connector.label} source`;
      const status = testState === "pass" ? "open" : testState === "fail" ? "auth_required" : "discovered";
      const sensitivity = classifySensitivity({ name, service_type: connector.label, category: connector.category });
      const { data, error } = await supabase.from("data_sources").insert({
        org_id: org.id,
        name,
        service_type: connector.label,
        host: fieldValues.host || null,
        port: fieldValues.port ? Number(fieldValues.port) : connector.defaultPort ?? null,
        connector_type: connector.connectorType,
        status,
        category: connector.category,
        table_count: 0,
        row_count: 0,
        difficulty_score: 1,
        sensitivity_labels: sensitivity,
        tags: [],
      }).select().single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        org_id: org.id, action: "source.added", resource_type: "data_source", resource_id: data.id,
        details: { connector: connector.id, status },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sources"] });
      toast.success("Source added");
      setAddOpen(false);
      setAddName("");
      setFieldValues({});
      setTestState("idle");
    },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });

  const lifecycle = useMutation({
    mutationFn: async (vars: { id: string; action: "connect" | "authenticate" | "firewall_request" | "disconnect" }) => {
      const src = sources?.find((s) => s.id === vars.id);
      if (!src || !org) return;
      if (vars.action === "authenticate") {
        toast.loading("Authenticating…", { id: `act-${vars.id}` });
        await sleep(1300);
        toast.dismiss(`act-${vars.id}`);
      }
      if (vars.action === "firewall_request") {
        toast.loading("Requesting firewall exception…", { id: `act-${vars.id}` });
        await sleep(1500);
        toast.dismiss(`act-${vars.id}`);
      }
      const patch =
        vars.action === "connect" ? { status: "connected", connected_at: new Date().toISOString() } :
        vars.action === "authenticate" ? { status: "connected", connected_at: new Date().toISOString(), credential_label: `OAuth token •••${Math.floor(1000 + Math.random() * 9000)}` } :
        vars.action === "firewall_request" ? { status: "open" } :
        { status: "open", connected_at: null };
      const { error } = await supabase.from("data_sources").update(patch).eq("id", vars.id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        org_id: org.id, action: `source.${vars.action}`, resource_type: "data_source", resource_id: vars.id,
        details: { name: src.name },
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["sources"] });
      qc.invalidateQueries({ queryKey: ["source-audit", vars.id] });
      const msg = { connect: "Connected", authenticate: "Authenticated & connected", firewall_request: "Firewall exception approved", disconnect: "Disconnected" }[vars.action];
      toast.success(msg);
    },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });

  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      const src = sources?.find((s) => s.id === id);
      const { error } = await supabase.from("data_sources").delete().eq("id", id);
      if (error) throw error;
      if (org) await supabase.from("audit_logs").insert({
        org_id: org.id, action: "source.deleted", resource_type: "data_source", resource_id: id, details: { name: src?.name },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sources"] });
      setDetailId(null);
      toast.success("Source deleted");
    },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });

  const bulkConnect = useMutation({
    mutationFn: async () => {
      const ids = [...selected];
      const { error } = await supabase.from("data_sources").update({ status: "connected", connected_at: new Date().toISOString() }).in("id", ids);
      if (error) throw error;
      if (org) await supabase.from("audit_logs").insert({
        org_id: org.id, action: "source.bulk_connect", resource_type: "data_source", details: { count: ids.length },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sources"] }); setSelected(new Set()); toast.success("Sources connected"); },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      const ids = [...selected];
      const { error } = await supabase.from("data_sources").delete().in("id", ids);
      if (error) throw error;
      if (org) await supabase.from("audit_logs").insert({
        org_id: org.id, action: "source.bulk_delete", resource_type: "data_source", details: { count: ids.length },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sources"] }); setSelected(new Set()); toast.success("Sources deleted"); },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });

  const filtered = useMemo(() => {
    return (sources ?? []).filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      if (search.trim() && !`${s.name} ${s.service_type} ${s.host ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [sources, statusFilter, categoryFilter, search]);

  const toggleSelected = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));
  const toggleSelectAll = () => setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((s) => s.id)));

  const scanScope = SCAN_TYPES.find((s) => s.id === scanType)!;

  return (
    <div>
      <PageHeader
        phase="01 · Find"
        title="Data source discovery"
        desc="Authorized network scans, cloud sweeps, and manual onboarding surface every database, API, and SaaS in your org."
        action={
          <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setFieldValues({}); setTestState("idle"); setAddName(""); } }}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" /> Add custom source</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add custom source</DialogTitle>
                <DialogDescription>Manually onboard a connector NEXUS didn't discover on its own.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Connector</Label>
                  <Select value={connectorId} onValueChange={(v) => { setConnectorId(v); setFieldValues({}); setTestState("idle"); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <div key={cat}>
                          <div className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{cat}</div>
                          {CONNECTOR_CATALOG.filter((c) => c.category === cat).map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Display name</Label><Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder={`${connector.label} source`} /></div>
                {connector.fields.map((f) => (
                  <div key={f.key}>
                    <Label>{f.label}</Label>
                    <Input
                      type={f.type === "number" ? "number" : f.type}
                      value={fieldValues[f.key] ?? ""}
                      onChange={(e) => { setFieldValues({ ...fieldValues, [f.key]: e.target.value }); setTestState("idle"); }}
                      placeholder={f.placeholder ?? (f.key === "port" ? String(connector.defaultPort ?? "") : undefined)}
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    {testState === "idle" && "Connection not tested yet"}
                    {testState === "testing" && "Testing connection…"}
                    {testState === "pass" && <span className="text-success">Connection succeeded</span>}
                    {testState === "fail" && <span className="text-destructive">Connection failed — check credentials</span>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => testConnection.mutate()} disabled={testState === "testing"}>
                    {testState === "testing" ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null} Test connection
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => addSource.mutate()} disabled={addSource.isPending}>Add source</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="space-y-6 p-8">
        {/* Scanner panel */}
        <div className="rounded-xl border border-border bg-card-gradient p-5">
          <div className="mb-4 flex items-center gap-2">
            <Radar className="h-4 w-4 text-primary" />
            <span className="font-medium">Discovery scanner</span>
            <span className="text-xs text-muted-foreground">Banner grabbing · service fingerprinting · OAuth probe</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={scanType} onValueChange={(v) => { setScanType(v); setTarget(SCAN_TYPES.find((s) => s.id === v)!.placeholder); }}>
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{SCAN_TYPES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={target} onChange={(e) => setTarget(e.target.value)} className="max-w-xs" placeholder={scanScope.placeholder} />
            <Button onClick={() => scan.mutate()} disabled={scanning} className="bg-primary text-primary-foreground">
              <Search className="mr-2 h-4 w-4" /> {scanning ? "Scanning..." : "Scan"}
            </Button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Scope: {scanScope.categories.join(", ")} connectors
          </div>

          {(scanning || liveFeed.length > 0) && (
            <div className="mt-4 space-y-1.5 rounded-lg border border-primary/20 bg-background/40 p-3 font-mono text-xs">
              {liveFeed.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-foreground/80">
                  <span className="text-success">✓</span> found {c.service_type} · <span className="text-muted-foreground">{c.name}</span>
                </div>
              ))}
              {scanning && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> scanning {target}…
                </div>
              )}
            </div>
          )}

          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen} className="mt-4">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <History className="h-3.5 w-3.5" /> Scan history ({scans?.length ?? 0})
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1">
              {!scans?.length ? (
                <div className="text-xs text-muted-foreground">No scans yet.</div>
              ) : scans.map((sc) => (
                <div key={sc.id} className="flex items-center justify-between rounded-md bg-secondary/30 px-3 py-1.5 text-xs">
                  <span>{SCAN_TYPES.find((s) => s.id === sc.scan_type)?.label ?? sc.scan_type} · <span className="font-mono text-muted-foreground">{sc.target}</span></span>
                  <span className="text-muted-foreground">{sc.status === "completed" ? `${sc.sources_found ?? 0} found` : sc.status} · {new Date(sc.created_at).toLocaleString()}</span>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sources…" className="max-w-xs" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.keys(STATUS_META).map((s) => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {selected.size > 0 && (
            <div className="ml-auto flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5">
              <span className="text-xs text-foreground/80">{selected.size} selected</span>
              <Button size="sm" variant="outline" onClick={() => bulkConnect.mutate()} disabled={bulkConnect.isPending}>Connect</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button size="sm" variant="outline" className="text-destructive"><Trash2 className="mr-1.5 h-3 w-3" />Delete</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {selected.size} source{selected.size > 1 ? "s" : ""}?</AlertDialogTitle>
                    <AlertDialogDescription>This removes them from your discovered inventory. This can't be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => bulkDelete.mutate()}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}><X className="h-3.5 w-3.5" /></Button>
            </div>
          )}
        </div>

        {/* Source list */}
        <div className="rounded-xl border border-border bg-card-gradient">
          <div className="border-b border-border px-5 py-3 flex items-center gap-3">
            <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} disabled={!filtered.length} />
            <h3 className="font-semibold">Discovered sources <span className="ml-2 text-xs text-muted-foreground">({filtered.length}{sources && sources.length !== filtered.length ? ` of ${sources.length}` : ""})</span></h3>
          </div>
          {!sources?.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No sources yet. Run a discovery scan or add a custom source.</div>
          ) : !filtered.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No sources match your filters.</div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((s) => {
                const Icon = iconFor(s.service_type, s.category);
                const action = primaryAction(s.status);
                return (
                  <li key={s.id} className="flex items-center gap-4 p-5 hover:bg-secondary/30">
                    <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggleSelected(s.id)} />
                    <button className="flex flex-1 items-center gap-4 text-left" onClick={() => setDetailId(s.id)}>
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{s.name}</span>
                          <StatusBadge status={s.status} />
                          <SensitivityBadges items={labels(s.sensitivity_labels)} />
                        </div>
                        <div className="mt-1 font-mono text-xs text-muted-foreground">
                          {s.service_type} · {s.host}{s.port ? `:${s.port}` : ""} · {s.connector_type}
                        </div>
                        {(s.table_count ?? 0) > 0 && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {s.table_count} tables · {((s.row_count ?? 0) / 1_000_000).toFixed(1)}M rows · difficulty {s.difficulty_score}/5
                          </div>
                        )}
                      </div>
                    </button>
                    {action && (
                      <Button size="sm" variant={action.action === "connect" ? "default" : "outline"} className={action.action === "connect" ? "bg-primary text-primary-foreground" : ""} onClick={() => lifecycle.mutate({ id: s.id, action: action.action })} disabled={lifecycle.isPending}>
                        <action.icon className="mr-2 h-3 w-3" /> {action.label}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Detail sheet */}
      <Sheet open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {detailSource && (
            <>
              <SheetHeader>
                <SheetTitle>{detailSource.name}</SheetTitle>
                <SheetDescription>{detailSource.service_type} · {detailSource.connector_type}</SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <Tabs defaultValue="overview">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="schema">Schema</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview" className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={detailSource.status} />
                      {detailSource.category && <Badge variant="outline">{detailSource.category}</Badge>}
                      <SensitivityBadges items={labels(detailSource.sensitivity_labels)} />
                    </div>
                    <div className="space-y-1 font-mono text-xs text-muted-foreground">
                      <div>Host: {detailSource.host}{detailSource.port ? `:${detailSource.port}` : ""}</div>
                      <div>Tables: {detailSource.table_count ?? 0} · Rows: {(detailSource.row_count ?? 0).toLocaleString()}</div>
                      <div>Difficulty: {detailSource.difficulty_score}/5</div>
                      {detailSource.credential_label && <div>Credential: {detailSource.credential_label}</div>}
                      {detailSource.connected_at && <div>Connected: {new Date(detailSource.connected_at).toLocaleString()}</div>}
                      <div>Discovered: {new Date(detailSource.created_at).toLocaleString()}</div>
                    </div>
                  </TabsContent>
                  <TabsContent value="schema" className="space-y-2">
                    {mockSchemaPreview(detailSource).map((t) => (
                      <div key={t.table} className="rounded-lg border border-border bg-secondary/20 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm font-medium">{t.table}</span>
                          <span className="text-xs text-muted-foreground">{t.rows.toLocaleString()} rows</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {t.columns.map((c, i) => <span key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{c}</span>)}
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="activity" className="space-y-2">
                    {!sourceAudit?.length ? (
                      <div className="text-sm text-muted-foreground">No activity recorded yet.</div>
                    ) : sourceAudit.map((a) => (
                      <div key={a.id} className="rounded-lg bg-secondary/20 px-3 py-2 text-xs">
                        <div className="font-mono">{a.action}</div>
                        <div className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </div>
              <SheetFooter className="mt-6 gap-2">
                {(() => {
                  const action = primaryAction(detailSource.status);
                  return action ? (
                    <Button onClick={() => lifecycle.mutate({ id: detailSource.id, action: action.action })} disabled={lifecycle.isPending} className="bg-primary text-primary-foreground">
                      <action.icon className="mr-2 h-4 w-4" /> {action.label}
                    </Button>
                  ) : null;
                })()}
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="outline" className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {detailSource.name}?</AlertDialogTitle>
                      <AlertDialogDescription>This removes it from your discovered inventory. This can't be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteSource.mutate(detailSource.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
