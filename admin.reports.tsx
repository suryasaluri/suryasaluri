import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { formatCurrency, formatCurrencyFull, initials } from "@/lib/format";
import { exportCsv } from "@/lib/csv";
import { TRAFFIC_SOURCE_LABELS, INTEGRATION_LABELS } from "@/lib/db-types";
import type { SocialEngagement, TrafficSource } from "@/lib/db-types";
import {
  Download,
  Wallet,
  AlertTriangle,
  TrendingUp,
  Building2,
  Globe,
  PhoneCall,
  Award,
  Youtube,
  Instagram,
  Facebook,
  Music2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: Reports,
});

function useReportData() {
  return useQuery({
    queryKey: ["reports-data"],
    queryFn: async () => {
      const [properties, payments, projects] = await Promise.all([
        supabase.from("properties").select("id, project_id, property_type, status, price"),
        supabase.from("payments").select("property_id, amount, status, paid_date, due_date"),
        supabase.from("projects").select("id, name"),
      ]);
      if (properties.error) throw properties.error;
      if (payments.error) throw payments.error;
      if (projects.error) throw projects.error;
      return { properties: properties.data, payments: payments.data, projects: projects.data };
    },
  });
}

function SalesReportTab() {
  const { data, isLoading } = useReportData();
  const [projectFilter, setProjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filteredProperties = useMemo(() => {
    return (data?.properties ?? []).filter((p) => {
      if (projectFilter !== "all" && p.project_id !== projectFilter) return false;
      if (typeFilter !== "all" && p.property_type !== typeFilter) return false;
      return true;
    });
  }, [data, projectFilter, typeFilter]);

  const propertyIds = useMemo(
    () => new Set(filteredProperties.map((p) => p.id)),
    [filteredProperties],
  );

  const filteredPayments = useMemo(() => {
    return (data?.payments ?? []).filter((p) => {
      if (!propertyIds.has(p.property_id)) return false;
      const refDate = p.paid_date ?? p.due_date;
      if (from && refDate && refDate < from) return false;
      if (to && refDate && refDate > to) return false;
      return true;
    });
  }, [data, propertyIds, from, to]);

  const summary = useMemo(() => {
    const collections = filteredPayments
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + Number(p.amount), 0);
    const pendingDues = filteredPayments
      .filter((p) => p.status !== "paid")
      .reduce((s, p) => s + Number(p.amount), 0);
    const sold = filteredProperties.filter((p) => p.status === "sold").length;
    const available = filteredProperties.filter((p) => p.status === "available").length;
    const blocked = filteredProperties.filter((p) => p.status === "blocked").length;
    return { collections, pendingDues, sold, available, blocked, total: filteredProperties.length };
  }, [filteredProperties, filteredPayments]);

  const byProject = useMemo(() => {
    return (data?.projects ?? [])
      .map((proj) => {
        const props = filteredProperties.filter((p) => p.project_id === proj.id);
        const propIds = new Set(props.map((p) => p.id));
        const pays = filteredPayments.filter((p) => propIds.has(p.property_id));
        return {
          Project: proj.name,
          Total: props.length,
          Available: props.filter((p) => p.status === "available").length,
          Blocked: props.filter((p) => p.status === "blocked").length,
          Sold: props.filter((p) => p.status === "sold").length,
          Collections: pays
            .filter((p) => p.status === "paid")
            .reduce((s, p) => s + Number(p.amount), 0),
          "Pending Dues": pays
            .filter((p) => p.status !== "paid")
            .reduce((s, p) => s + Number(p.amount), 0),
        };
      })
      .filter((r) => r.Total > 0 || projectFilter !== "all");
  }, [data, filteredProperties, filteredPayments, projectFilter]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={() => exportCsv("san-connect-sales-report.csv", byProject)}
          variant="outline"
        >
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="min-w-[160px]">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Project</Label>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {data?.projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[140px]">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Property type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="plot">Plot</SelectItem>
              <SelectItem value="flat">Flat</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[150px]">
          <Label className="mb-1.5 block text-xs text-muted-foreground">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="min-w-[150px]">
          <Label className="mb-1.5 block text-xs text-muted-foreground">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-success/15 text-success">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{formatCurrency(summary.collections)}</div>
              <div className="text-xs text-muted-foreground">Collections</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-warning/15 text-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{formatCurrency(summary.pendingDues)}</div>
              <div className="text-xs text-muted-foreground">Pending dues</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{summary.sold}</div>
              <div className="text-xs text-muted-foreground">Sold ({summary.total} total)</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold">
                {summary.available} / {summary.blocked}
              </div>
              <div className="text-xs text-muted-foreground">Available / Blocked</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Breakdown by project</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Blocked</TableHead>
                <TableHead>Sold</TableHead>
                <TableHead>Collections</TableHead>
                <TableHead>Pending dues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byProject.map((r) => (
                <TableRow key={r.Project}>
                  <TableCell className="font-medium">{r.Project}</TableCell>
                  <TableCell>{r.Total}</TableCell>
                  <TableCell>{r.Available}</TableCell>
                  <TableCell>{r.Blocked}</TableCell>
                  <TableCell>{r.Sold}</TableCell>
                  <TableCell>{formatCurrencyFull(r.Collections)}</TableCell>
                  <TableCell>{formatCurrencyFull(r["Pending Dues"])}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------- Website & Marketing ------------------------------- */

const PLATFORM_ICON = {
  youtube: Youtube,
  instagram: Instagram,
  facebook_meta: Facebook,
  tiktok: Music2,
} as const;

function useWebsiteReportData() {
  return useQuery({
    queryKey: ["website-report"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 89);
      const sinceStr = since.toISOString().slice(0, 10);
      const [metrics, social] = await Promise.all([
        supabase.from("website_metrics").select("*").gte("date", sinceStr).order("date"),
        supabase.from("social_engagement").select("*").gte("date", sinceStr).order("date"),
      ]);
      if (metrics.error) throw metrics.error;
      if (social.error) throw social.error;
      return { metrics: metrics.data, social: social.data };
    },
  });
}

function WebsiteMarketingTab() {
  const { data, isLoading } = useWebsiteReportData();
  const metrics = useMemo(() => data?.metrics ?? [], [data]);
  const last30 = useMemo(() => metrics.slice(-30), [metrics]);

  const totals = useMemo(() => {
    const sessions = last30.reduce((s, m) => s + m.sessions, 0);
    const leads = last30.reduce((s, m) => s + m.leads_generated, 0);
    const avgBounce = last30.length
      ? last30.reduce((s, m) => s + Number(m.bounce_rate_pct), 0) / last30.length
      : 0;
    const latestSeo = metrics.length ? metrics[metrics.length - 1].seo_score : 0;
    return { sessions, leads, avgBounce, latestSeo };
  }, [last30, metrics]);

  const chartData = useMemo(
    () => metrics.map((m) => ({ date: m.date.slice(5), sessions: m.sessions })),
    [metrics],
  );

  const sourceBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of last30) map.set(m.top_source, (map.get(m.top_source) ?? 0) + m.leads_generated);
    return Array.from(map.entries())
      .map(([source, leads]) => ({
        source: TRAFFIC_SOURCE_LABELS[source as TrafficSource] ?? source,
        leads,
      }))
      .sort((a, b) => b.leads - a.leads);
  }, [last30]);

  const platforms = useMemo(() => {
    const byPlatform = new Map<string, SocialEngagement[]>();
    for (const row of data?.social ?? []) {
      if (!byPlatform.has(row.platform)) byPlatform.set(row.platform, []);
      byPlatform.get(row.platform)!.push(row);
    }
    return Array.from(byPlatform.entries())
      .map(([platform, rows]) => {
        const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
        const latest = sorted[sorted.length - 1];
        const first = sorted[0];
        const growthPct =
          first && first.followers > 0
            ? ((latest.followers - first.followers) / first.followers) * 100
            : 0;
        return { platform, latest, growthPct };
      })
      .filter((p) => p.platform in PLATFORM_ICON);
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={() =>
            exportCsv(
              "san-connect-website-report.csv",
              metrics.map((m) => ({
                Date: m.date,
                Sessions: m.sessions,
                "Unique Visitors": m.unique_visitors,
                "Page Views": m.page_views,
                "Leads Generated": m.leads_generated,
                "SEO Score": m.seo_score,
              })),
            )
          }
          variant="outline"
        >
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{totals.sessions.toLocaleString("en-IN")}</div>
              <div className="text-xs text-muted-foreground">Sessions (30d)</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-success/15 text-success">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{totals.leads}</div>
              <div className="text-xs text-muted-foreground">Leads from website (30d)</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-foreground">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{totals.latestSeo}/100</div>
              <div className="text-xs text-muted-foreground">SEO score</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-warning/15 text-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{totals.avgBounce.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Avg bounce rate</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sessions, last 90 days</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="date"
                  fontSize={10}
                  stroke="var(--color-muted-foreground)"
                  minTickGap={24}
                />
                <YAxis fontSize={10} stroke="var(--color-muted-foreground)" width={32} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sessions"
                  stroke="var(--color-primary)"
                  fill="var(--color-primary)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads by source, last 30 days</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceBreakdown} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  type="number"
                  fontSize={10}
                  stroke="var(--color-muted-foreground)"
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="source"
                  fontSize={11}
                  stroke="var(--color-muted-foreground)"
                  width={90}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="leads" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Social engagement</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {platforms.map(({ platform, latest, growthPct }) => {
            const Icon = PLATFORM_ICON[platform as keyof typeof PLATFORM_ICON];
            const meta = INTEGRATION_LABELS[platform as keyof typeof INTEGRATION_LABELS];
            return (
              <Card key={platform}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-muted text-foreground/80">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">{meta?.label ?? platform}</span>
                  </div>
                  <div className="mt-3 text-xl font-bold">
                    {latest.followers.toLocaleString("en-IN")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    followers ·{" "}
                    <span className={growthPct >= 0 ? "text-success" : "text-destructive"}>
                      {growthPct >= 0 ? "+" : ""}
                      {growthPct.toFixed(1)}%
                    </span>{" "}
                    (90d)
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {Number(latest.engagement_rate_pct).toFixed(1)}% engagement rate
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Employee Efficiency ------------------------------- */

const STAFF_ROLES_FOR_EFFICIENCY = ["sales", "finance", "legal", "admin"] as const;

function useEfficiencyData() {
  return useQuery({
    queryKey: ["efficiency-report"],
    queryFn: async () => {
      const since30 = new Date();
      since30.setDate(since30.getDate() - 29);
      const sinceStr = since30.toISOString().slice(0, 10);
      const [staff, customers, visits, commissions, attendance, calls] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, role")
          .in("role", STAFF_ROLES_FOR_EFFICIENCY),
        supabase.from("customers").select("assigned_sales_owner, lead_status"),
        supabase.from("site_visits").select("assigned_staff, status"),
        supabase.from("commissions").select("sales_staff_id, amount, status"),
        supabase.from("attendance_records").select("profile_id, status").gte("date", sinceStr),
        supabase.from("call_logs").select("staff_id"),
      ]);
      if (staff.error) throw staff.error;
      if (customers.error) throw customers.error;
      if (visits.error) throw visits.error;
      if (commissions.error) throw commissions.error;
      if (attendance.error) throw attendance.error;
      if (calls.error) throw calls.error;
      return {
        staff: staff.data,
        customers: customers.data,
        visits: visits.data,
        commissions: commissions.data,
        attendance: attendance.data,
        calls: calls.data,
      };
    },
  });
}

function EmployeeEfficiencyTab() {
  const { data, isLoading } = useEfficiencyData();

  const rows = useMemo(() => {
    if (!data) return [];
    return data.staff
      .map((s) => {
        const leads = data.customers.filter((c) => c.assigned_sales_owner === s.id);
        const sold = leads.filter((c) => c.lead_status === "sold").length;
        const conversion = leads.length ? Math.round((sold / leads.length) * 100) : 0;
        const visitsCompleted = data.visits.filter(
          (v) => v.assigned_staff === s.id && v.status === "completed",
        ).length;
        const commissionEarned = data.commissions
          .filter((c) => c.sales_staff_id === s.id)
          .reduce((sum, c) => sum + Number(c.amount), 0);
        const callsLogged = data.calls.filter((c) => c.staff_id === s.id).length;
        const attRecords = data.attendance.filter((a) => a.profile_id === s.id);
        const attRate = attRecords.length
          ? Math.round(
              (attRecords.filter((a) => a.status === "present").length / attRecords.length) * 100,
            )
          : 0;
        return {
          id: s.id,
          name: s.full_name ?? "—",
          role: s.role,
          leads: leads.length,
          sold,
          conversion,
          visitsCompleted,
          commissionEarned,
          callsLogged,
          attRate,
        };
      })
      .sort((a, b) => b.conversion - a.conversion || b.leads - a.leads);
  }, [data]);

  const chartData = useMemo(
    () =>
      rows
        .filter((r) => r.role === "sales")
        .map((r) => ({ name: r.name.split(" ")[0], Sold: r.sold })),
    [rows],
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={() =>
            exportCsv(
              "san-connect-employee-efficiency.csv",
              rows.map((r) => ({
                Name: r.name,
                Role: r.role,
                "Leads Handled": r.leads,
                Sold: r.sold,
                "Conversion %": r.conversion,
                "Site Visits Completed": r.visitsCompleted,
                "Calls Logged": r.callsLogged,
                "Commission Earned": r.commissionEarned,
                "Attendance % (30d)": r.attRate,
              })),
            )
          }
          variant="outline"
        >
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Units sold by sales rep</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--color-muted-foreground)" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="Sold" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff performance</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Sold</TableHead>
                <TableHead>Conversion</TableHead>
                <TableHead>Visits done</TableHead>
                <TableHead>
                  <PhoneCall className="inline h-3.5 w-3.5" /> Calls
                </TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Attendance (30d)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-primary/15 text-[10px] text-primary">
                          {initials(r.name)}
                        </AvatarFallback>
                      </Avatar>
                      {r.name}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{r.role}</TableCell>
                  <TableCell>{r.leads}</TableCell>
                  <TableCell>{r.sold}</TableCell>
                  <TableCell>{r.conversion}%</TableCell>
                  <TableCell>{r.visitsCompleted}</TableCell>
                  <TableCell>{r.callsLogged}</TableCell>
                  <TableCell>{formatCurrencyFull(r.commissionEarned)}</TableCell>
                  <TableCell>{r.attRate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------- Custom Report ------------------------------- */

type ReportMetric = "collections" | "pending_dues" | "leads" | "site_visits" | "commissions";
type ReportGroupBy = "month" | "staff" | "project";

const METRIC_LABELS: Record<ReportMetric, string> = {
  collections: "Collections",
  pending_dues: "Pending Dues",
  leads: "New Leads",
  site_visits: "Site Visits",
  commissions: "Commissions Earned",
};

function useCustomReportData() {
  return useQuery({
    queryKey: ["custom-report-data"],
    queryFn: async () => {
      const [payments, properties, projects, customers, visits, commissions, staff] =
        await Promise.all([
          supabase
            .from("payments")
            .select("property_id, customer_id, amount, status, paid_date, due_date"),
          supabase.from("properties").select("id, project_id"),
          supabase.from("projects").select("id, name"),
          supabase.from("customers").select("id, assigned_sales_owner, created_at, lead_status"),
          supabase.from("site_visits").select("assigned_staff, project_id, status, scheduled_date"),
          supabase
            .from("commissions")
            .select("sales_staff_id, property_id, amount, status, created_at"),
          supabase.from("profiles").select("id, full_name").in("role", STAFF_ROLES_FOR_EFFICIENCY),
        ]);
      if (payments.error) throw payments.error;
      if (properties.error) throw properties.error;
      if (projects.error) throw projects.error;
      if (customers.error) throw customers.error;
      if (visits.error) throw visits.error;
      if (commissions.error) throw commissions.error;
      if (staff.error) throw staff.error;
      return {
        payments: payments.data,
        properties: properties.data,
        projects: projects.data,
        customers: customers.data,
        visits: visits.data,
        commissions: commissions.data,
        staff: staff.data,
      };
    },
  });
}

function CustomReportTab() {
  const { data, isLoading } = useCustomReportData();
  const [metric, setMetric] = useState<ReportMetric>("collections");
  const [groupBy, setGroupBy] = useState<ReportGroupBy>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const propProject = useMemo(
    () => new Map((data?.properties ?? []).map((p) => [p.id, p.project_id])),
    [data],
  );
  const projectName = useMemo(
    () => new Map((data?.projects ?? []).map((p) => [p.id, p.name])),
    [data],
  );
  const staffName = useMemo(
    () => new Map((data?.staff ?? []).map((s) => [s.id, s.full_name ?? "—"])),
    [data],
  );
  const custOwner = useMemo(
    () => new Map((data?.customers ?? []).map((c) => [c.id, c.assigned_sales_owner])),
    [data],
  );

  const inRange = useCallback(
    (d: string | null) => {
      if (!from && !to) return true;
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    },
    [from, to],
  );

  const groupLabel = useCallback(
    (opts: { date: string | null; staffId?: string | null; projectId?: string | null }) => {
      if (groupBy === "month") return opts.date ? opts.date.slice(0, 7) : "Unknown date";
      if (groupBy === "staff")
        return opts.staffId ? (staffName.get(opts.staffId) ?? "Unknown") : "Unassigned";
      return opts.projectId ? (projectName.get(opts.projectId) ?? "Unknown") : "Unassigned";
    },
    [groupBy, staffName, projectName],
  );

  const isCurrency =
    metric === "collections" || metric === "pending_dues" || metric === "commissions";

  const result = useMemo(() => {
    const map = new Map<string, number>();
    const add = (key: string, val: number) => map.set(key, (map.get(key) ?? 0) + val);

    if (metric === "collections" || metric === "pending_dues") {
      const wantPaid = metric === "collections";
      for (const p of data?.payments ?? []) {
        if (wantPaid ? p.status !== "paid" : p.status === "paid") continue;
        const refDate = p.paid_date ?? p.due_date;
        if (!inRange(refDate)) continue;
        add(
          groupLabel({
            date: refDate,
            staffId: custOwner.get(p.customer_id) ?? null,
            projectId: propProject.get(p.property_id) ?? null,
          }),
          Number(p.amount),
        );
      }
    } else if (metric === "leads") {
      for (const c of data?.customers ?? []) {
        const d = c.created_at ? c.created_at.slice(0, 10) : null;
        if (!inRange(d)) continue;
        add(groupLabel({ date: d, staffId: c.assigned_sales_owner, projectId: null }), 1);
      }
    } else if (metric === "site_visits") {
      for (const v of data?.visits ?? []) {
        const d = v.scheduled_date ? v.scheduled_date.slice(0, 10) : null;
        if (!inRange(d)) continue;
        add(groupLabel({ date: d, staffId: v.assigned_staff, projectId: v.project_id }), 1);
      }
    } else {
      for (const c of data?.commissions ?? []) {
        const d = c.created_at ? c.created_at.slice(0, 10) : null;
        if (!inRange(d)) continue;
        add(
          groupLabel({
            date: d,
            staffId: c.sales_staff_id,
            projectId: propProject.get(c.property_id ?? "") ?? null,
          }),
          Number(c.amount),
        );
      }
    }
    return Array.from(map.entries())
      .map(([Group, Value]) => ({ Group, Value }))
      .sort((a, b) => b.Value - a.Value);
  }, [data, metric, propProject, custOwner, inRange, groupLabel]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px]">
            <Label className="mb-1.5 block text-xs text-muted-foreground">Metric</Label>
            <Select value={metric} onValueChange={(v) => setMetric(v as ReportMetric)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(METRIC_LABELS) as ReportMetric[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {METRIC_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Label className="mb-1.5 block text-xs text-muted-foreground">Group by</Label>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as ReportGroupBy)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="staff">Sales Staff</SelectItem>
                <SelectItem value="project">Project</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[150px]">
            <Label className="mb-1.5 block text-xs text-muted-foreground">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="min-w-[150px]">
            <Label className="mb-1.5 block text-xs text-muted-foreground">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <Button
          onClick={() => exportCsv(`san-connect-${metric}-by-${groupBy}.csv`, result)}
          variant="outline"
        >
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {result.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {METRIC_LABELS[metric]} by{" "}
              {groupBy === "month" ? "month" : groupBy === "staff" ? "sales staff" : "project"}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result.slice(0, 12)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="Group" fontSize={10} stroke="var(--color-muted-foreground)" />
                <YAxis
                  fontSize={10}
                  stroke="var(--color-muted-foreground)"
                  tickFormatter={(v) => (isCurrency ? formatCurrency(v) : String(v))}
                  width={isCurrency ? 60 : 32}
                />
                <Tooltip
                  formatter={(v: number) => (isCurrency ? formatCurrency(v) : v)}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="Value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {!isLoading && !result.length && (
            <p className="p-5 text-sm text-muted-foreground">No data for this selection.</p>
          )}
          {!!result.length && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.map((r) => (
                  <TableRow key={r.Group}>
                    <TableCell className="font-medium">{r.Group}</TableCell>
                    <TableCell className="text-right">
                      {isCurrency ? formatCurrencyFull(r.Value) : r.Value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------- Page ------------------------------- */

function Reports() {
  return (
    <div>
      <PageHeader
        title="Reports"
        desc="A single place for sales, marketing, team and custom reporting — filterable and exportable."
      />
      <div className="p-4 md:p-8">
        <Tabs defaultValue="sales">
          <TabsList>
            <TabsTrigger value="sales">Sales &amp; Inventory</TabsTrigger>
            <TabsTrigger value="website">Website &amp; Marketing</TabsTrigger>
            <TabsTrigger value="efficiency">Employee Efficiency</TabsTrigger>
            <TabsTrigger value="custom">Custom Report</TabsTrigger>
          </TabsList>
          <TabsContent value="sales" className="mt-4">
            <SalesReportTab />
          </TabsContent>
          <TabsContent value="website" className="mt-4">
            <WebsiteMarketingTab />
          </TabsContent>
          <TabsContent value="efficiency" className="mt-4">
            <EmployeeEfficiencyTab />
          </TabsContent>
          <TabsContent value="custom" className="mt-4">
            <CustomReportTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
