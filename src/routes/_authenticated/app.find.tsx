import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { useState } from "react";
import { toast } from "sonner";
import { Search, Radar, Database, Cloud, FileBox, Server, Lock, Plug } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/find")({
  component: FindPage,
});

const ICON: Record<string, any> = {
  PostgreSQL: Database, MySQL: Database, Oracle: Database, MongoDB: Database,
  Salesforce: Cloud, HubSpot: Cloud, Stripe: Cloud,
  "AWS S3": FileBox, Snowflake: Server, BigQuery: Server,
};

const SIMULATED = [
  { name: "Production Postgres", service_type: "PostgreSQL", host: "prod-db.internal", port: 5432, status: "open", connector_type: "JDBC", table_count: 245, row_count: 12500000, difficulty_score: 1 },
  { name: "Salesforce CRM", service_type: "Salesforce", host: "api.salesforce.com", port: 443, status: "auth_required", connector_type: "OAuth", table_count: 52, row_count: 3400000, difficulty_score: 2 },
  { name: "Marketing MySQL", service_type: "MySQL", host: "mkt-db.internal", port: 3306, status: "open", connector_type: "native", table_count: 88, row_count: 4200000, difficulty_score: 1 },
  { name: "Oracle Finance", service_type: "Oracle", host: "10.0.0.50", port: 1521, status: "blocked", connector_type: "Thin", table_count: 0, row_count: 0, difficulty_score: 4 },
  { name: "Analytics S3 Bucket", service_type: "AWS S3", host: "s3.amazonaws.com", port: 443, status: "open", connector_type: "boto3", table_count: 0, row_count: 0, difficulty_score: 2 },
  { name: "HubSpot Marketing", service_type: "HubSpot", host: "api.hubapi.com", port: 443, status: "auth_required", connector_type: "API key", table_count: 18, row_count: 850000, difficulty_score: 2 },
  { name: "Snowflake Warehouse", service_type: "Snowflake", host: "xy12345.snowflakecomputing.com", port: 443, status: "open", connector_type: "JDBC", table_count: 132, row_count: 89000000, difficulty_score: 1 },
];

function FindPage() {
  const { data: org } = useOrg();
  const qc = useQueryClient();
  const [range, setRange] = useState("10.0.0.0/24");

  const { data: sources } = useQuery({
    queryKey: ["sources", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("data_sources").select("*").eq("org_id", org!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const scan = useMutation({
    mutationFn: async () => {
      if (!org) return;
      // Simulate progressive discovery: insert any not-yet-discovered services
      const existingTypes = new Set((sources ?? []).map(s => s.service_type));
      const toAdd = SIMULATED.filter(s => !existingTypes.has(s.service_type)).slice(0, 3);
      if (toAdd.length === 0) toast.info("Network scanned — no new sources found");
      const rows = toAdd.map(s => ({ ...s, org_id: org.id }));
      if (rows.length) {
        const { error } = await supabase.from("data_sources").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sources"] }); toast.success("Scan complete"); },
    onError: (e: any) => toast.error(e.message),
  });

  const statusBadge = (s: string) => {
    const map: any = {
      open: ["Open · Ready", "bg-success/15 text-success border-success/30"],
      auth_required: ["Auth required", "bg-warning/15 text-warning border-warning/30"],
      blocked: ["Firewalled", "bg-destructive/15 text-destructive border-destructive/30"],
      discovered: ["Discovered", "bg-primary/15 text-primary border-primary/30"],
    };
    const [label, cls] = map[s] ?? [s, "bg-muted text-muted-foreground"];
    return <Badge variant="outline" className={cls}>{label}</Badge>;
  };

  return (
    <div>
      <PageHeader
        phase="01 · Find"
        title="Data source discovery"
        desc="Authorized network scans surface every database, API, and SaaS in your org."
      />
      <div className="space-y-6 p-8">
        <div className="rounded-xl border border-border bg-card-gradient p-5">
          <div className="mb-4 flex items-center gap-2">
            <Radar className="h-4 w-4 text-primary" />
            <span className="font-medium">Discovery scanner</span>
            <span className="text-xs text-muted-foreground">Banner grabbing · service fingerprinting · OAuth probe</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Input value={range} onChange={(e) => setRange(e.target.value)} className="max-w-xs" placeholder="10.0.0.0/24" />
            <Button onClick={() => scan.mutate()} disabled={scan.isPending} className="bg-primary text-primary-foreground">
              <Search className="mr-2 h-4 w-4" /> {scan.isPending ? "Scanning..." : "Scan authorized network"}
            </Button>
            <Button variant="outline"><Plug className="mr-2 h-4 w-4" /> Add custom source</Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card-gradient">
          <div className="border-b border-border px-5 py-3 flex items-center justify-between">
            <h3 className="font-semibold">Discovered sources <span className="ml-2 text-xs text-muted-foreground">({sources?.length ?? 0})</span></h3>
          </div>
          {!sources?.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No sources yet. Run a discovery scan to find your data systems.</div>
          ) : (
            <ul className="divide-y divide-border">
              {sources.map((s) => {
                const Icon = ICON[s.service_type] ?? Database;
                return (
                  <li key={s.id} className="flex items-center gap-4 p-5 hover:bg-secondary/30">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.name}</span>
                        {statusBadge(s.status)}
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
                    {s.status === "blocked" ? (
                      <Button size="sm" variant="outline"><Lock className="mr-2 h-3 w-3" /> Firewall request</Button>
                    ) : s.status === "auth_required" ? (
                      <Button size="sm" variant="outline">Authenticate</Button>
                    ) : (
                      <Button size="sm" className="bg-primary text-primary-foreground">Connect</Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
