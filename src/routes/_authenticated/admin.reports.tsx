import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatCurrency, formatCurrencyFull } from "@/lib/format";
import { exportCsv } from "@/lib/csv";
import { Download, Wallet, AlertTriangle, TrendingUp, Building2 } from "lucide-react";

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

function Reports() {
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
    <div>
      <PageHeader
        title="Reports"
        desc="Month-end summary of sales, collections and inventory — filterable and exportable."
        action={
          <Button
            onClick={() => exportCsv("san-connect-report.csv", byProject)}
            className="bg-primary text-primary-foreground"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        }
      />
      <div className="space-y-6 p-4 md:p-8">
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
    </div>
  );
}
