import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import {
  Building2,
  Wallet,
  AlertTriangle,
  Users2,
  LandPlot,
  Home as HomeIcon,
  ChevronRight,
  FileCheck2,
  ClipboardCheck,
  CalendarClock,
  PhoneCall,
} from "lucide-react";
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
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [
        properties,
        payments,
        customers,
        projects,
        pendingDocs,
        pendingApprovals,
        visitsToday,
      ] = await Promise.all([
        supabase.from("properties").select("property_type, status, project_id"),
        supabase.from("payments").select("amount, status, paid_date, due_date"),
        supabase.from("customers").select("lead_status, follow_up_at"),
        supabase.from("projects").select("id, name"),
        supabase
          .from("documents")
          .select("id", { count: "exact", head: true })
          .eq("verification_status", "pending"),
        supabase
          .from("approvals")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("site_visits")
          .select("id", { count: "exact", head: true })
          .eq("status", "scheduled")
          .gte("scheduled_date", todayStart.toISOString())
          .lte("scheduled_date", todayEnd.toISOString()),
      ]);
      if (properties.error) throw properties.error;
      if (payments.error) throw payments.error;
      if (customers.error) throw customers.error;
      if (projects.error) throw projects.error;
      if (pendingDocs.error) throw pendingDocs.error;
      if (pendingApprovals.error) throw pendingApprovals.error;
      if (visitsToday.error) throw visitsToday.error;
      return {
        properties: properties.data,
        payments: payments.data,
        customers: customers.data,
        projects: projects.data,
        pendingDocsCount: pendingDocs.count ?? 0,
        pendingApprovalsCount: pendingApprovals.count ?? 0,
        visitsTodayCount: visitsToday.count ?? 0,
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
    const followUpsDue = data.customers.filter(
      (c) => c.follow_up_at && new Date(c.follow_up_at) <= new Date(),
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
      followUpsDue,
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
            to="/admin/inventory"
          />
          <StatCard
            icon={HomeIcon}
            label="Available vs Sold"
            value={`${stats?.availableCount ?? 0} / ${stats?.soldCount ?? 0}`}
            sub="Available / Sold"
            to="/admin/inventory"
          />
          <StatCard
            icon={Wallet}
            label="Total collections"
            value={formatCurrency(stats?.collections ?? 0)}
            sub="All-time payments received"
            accent="success"
            to="/admin/payments"
          />
          <StatCard
            icon={AlertTriangle}
            label="Pending dues"
            value={formatCurrency(stats?.pendingDues ?? 0)}
            sub="Pending + overdue"
            accent="warning"
            to="/admin/payments"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            icon={LandPlot}
            label="Plots sold"
            value={`${stats?.plotsSold ?? 0} / ${stats?.plots ?? 0}`}
            to="/admin/inventory"
          />
          <StatCard
            icon={Building2}
            label="Flats sold"
            value={`${stats?.flatsSold ?? 0} / ${stats?.flats ?? 0}`}
            to="/admin/inventory"
          />
          <StatCard
            icon={Users2}
            label="Active leads"
            value={stats?.activeLeads ?? "—"}
            sub="New, Contacted or Site Visit"
            to="/admin/leads"
          />
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Needs attention today
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AttentionCard
              icon={FileCheck2}
              label="Documents to verify"
              value={data?.pendingDocsCount ?? 0}
              to="/admin/documents"
            />
            <AttentionCard
              icon={ClipboardCheck}
              label="Approvals pending"
              value={data?.pendingApprovalsCount ?? 0}
              to="/admin/approvals"
            />
            <AttentionCard
              icon={CalendarClock}
              label="Site visits today"
              value={data?.visitsTodayCount ?? 0}
              to="/admin/leads"
            />
            <AttentionCard
              icon={PhoneCall}
              label="Follow-ups due"
              value={stats?.followUpsDue ?? 0}
              to="/admin/leads"
            />
          </div>
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
  to,
}: {
  icon: typeof Building2;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: "success" | "warning";
  to?: string;
}) {
  const body = (
    <CardContent className="flex items-center gap-3 p-5">
      <div
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${accent === "success" ? "bg-success/15 text-success" : accent === "warning" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground/80">{sub}</div>}
      </div>
      {to && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />}
    </CardContent>
  );

  if (!to) return <Card>{body}</Card>;
  return (
    <Link to={to}>
      <Card className="transition hover:border-primary/40 hover:shadow-card">{body}</Card>
    </Link>
  );
}

function AttentionCard({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  to: string;
}) {
  const urgent = value > 0;
  return (
    <Link to={to}>
      <Card
        className={`transition hover:shadow-card ${urgent ? "border-warning/40 hover:border-warning/70" : "hover:border-primary/40"}`}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <div
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${urgent ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold">{value}</div>
            <div className="truncate text-xs text-muted-foreground">{label}</div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
        </CardContent>
      </Card>
    </Link>
  );
}
