import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { Building2, Wallet, AlertTriangle, Users2, LandPlot, Home as HomeIcon } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Overview,
});

function useOverviewData() {
  return useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [properties, payments, customers, projects] = await Promise.all([
        supabase.from("properties").select("property_type, status, project_id"),
        supabase.from("payments").select("amount, status, paid_date, due_date"),
        supabase.from("customers").select("lead_status"),
        supabase.from("projects").select("id, name"),
      ]);
      if (properties.error) throw properties.error;
      if (payments.error) throw payments.error;
      if (customers.error) throw customers.error;
      if (projects.error) throw projects.error;
      return {
        properties: properties.data,
        payments: payments.data,
        customers: customers.data,
        projects: projects.data,
      };
    },
  });
}

function Overview() {
  const { data, isLoading } = useOverviewData();

  const stats = useMemo(() => {
    if (!data) return null;
    const plots = data.properties.filter((p) => p.property_type === "plot");
    const flats = data.properties.filter((p) => p.property_type === "flat");
    const soldCount = data.properties.filter((p) => p.status === "sold").length;
    const availableCount = data.properties.filter((p) => p.status === "available").length;
    const collections = data.payments
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + Number(p.amount), 0);
    const pendingDues = data.payments
      .filter((p) => p.status !== "paid")
      .reduce((s, p) => s + Number(p.amount), 0);
    const activeLeads = data.customers.filter((c) =>
      ["new", "contacted", "site_visit"].includes(c.lead_status),
    ).length;
    return {
      total: data.properties.length,
      plots: plots.length,
      flats: flats.length,
      soldCount,
      availableCount,
      collections,
      pendingDues,
      activeLeads,
      plotsSold: plots.filter((p) => p.status === "sold").length,
      flatsSold: flats.filter((p) => p.status === "sold").length,
    };
  }, [data]);

  const salesTrend = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, number>();
    for (const p of data.payments) {
      if (p.status !== "paid" || !p.paid_date) continue;
      const key = p.paid_date.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + Number(p.amount));
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([month, amount]) => ({ month, amount }));
  }, [data]);

  const inventoryByProject = useMemo(() => {
    if (!data) return [];
    return data.projects.map((proj) => {
      const props = data.properties.filter((p) => p.project_id === proj.id);
      return {
        name: proj.name,
        Available: props.filter((p) => p.status === "available").length,
        Blocked: props.filter((p) => p.status === "blocked").length,
        Sold: props.filter((p) => p.status === "sold").length,
      };
    });
  }, [data]);

  return (
    <div>
      <PageHeader title="Overview" desc="Portfolio-wide snapshot across all projects." />
      <div className="space-y-6 p-4 md:p-8">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Building2}
            label="Total properties"
            value={stats?.total ?? "—"}
            sub={`${stats?.plots ?? 0} plots · ${stats?.flats ?? 0} flats`}
          />
          <StatCard
            icon={HomeIcon}
            label="Available vs Sold"
            value={`${stats?.availableCount ?? 0} / ${stats?.soldCount ?? 0}`}
            sub="Available / Sold"
          />
          <StatCard
            icon={Wallet}
            label="Total collections"
            value={formatCurrency(stats?.collections ?? 0)}
            sub="All-time payments received"
            accent="success"
          />
          <StatCard
            icon={AlertTriangle}
            label="Pending dues"
            value={formatCurrency(stats?.pendingDues ?? 0)}
            sub="Pending + overdue"
            accent="warning"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            icon={LandPlot}
            label="Plots sold"
            value={`${stats?.plotsSold ?? 0} / ${stats?.plots ?? 0}`}
          />
          <StatCard
            icon={Building2}
            label="Flats sold"
            value={`${stats?.flatsSold ?? 0} / ${stats?.flats ?? 0}`}
          />
          <StatCard
            icon={Users2}
            label="Active leads"
            value={stats?.activeLeads ?? "—"}
            sub="New, Contacted or Site Visit"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sales trend (collections)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" fontSize={11} stroke="var(--color-muted-foreground)" />
                  <YAxis
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                    tickFormatter={(v) => formatCurrency(v)}
                    width={70}
                  />
                  <Tooltip
                    formatter={(v: number) => formatCurrency(v)}
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inventory status by project</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryByProject}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" fontSize={11} stroke="var(--color-muted-foreground)" />
                  <YAxis
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="Available"
                    stackId="a"
                    fill="var(--color-chart-2)"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar dataKey="Blocked" stackId="a" fill="var(--color-chart-4)" />
                  <Bar
                    dataKey="Sold"
                    stackId="a"
                    fill="var(--color-chart-1)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Building2;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: "success" | "warning";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${accent === "success" ? "bg-success/15 text-success" : accent === "warning" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
          {sub && <div className="text-[11px] text-muted-foreground/80">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
