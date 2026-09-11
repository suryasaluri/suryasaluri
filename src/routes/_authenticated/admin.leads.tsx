import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { LEAD_STAGES, LEAD_LABELS } from "@/lib/db-types";
import type { LeadStatus, Customer, SiteVisitStatus, LeadNote, SiteVisit } from "@/lib/db-types";
import { formatDateTime, initials } from "@/lib/format";
import { useProfile } from "@/lib/useProfile";
import { toast } from "sonner";
import { Phone, Mail, Plus, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/leads")({
  component: LeadsCrm,
});

type CustomerRow = Customer & { profiles: { full_name: string | null } | null };

function useCustomers() {
  return useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*, profiles:assigned_sales_owner(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CustomerRow[];
    },
  });
}

function useSalesStaff() {
  return useQuery({
    queryKey: ["sales-staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("role", ["sales", "admin"])
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });
}

function CustomerDialog({
  customer,
  trigger,
}: {
  customer: Customer & { profiles?: { full_name: string | null } | null };
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { data: staff } = useSalesStaff();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const { data: notes } = useQuery({
    queryKey: ["lead-notes", customer.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_notes")
        .select("*, profiles:author_id(full_name)")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (LeadNote & { profiles: { full_name: string | null } | null })[];
    },
  });

  const updateField = async (
    field: "lead_status" | "assigned_sales_owner" | "referral_source",
    value: string,
  ) => {
    const { error } = await supabase
      .from("customers")
      .update({ [field]: value } as never)
      .eq("id", customer.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-customers"] });
  };

  const addNote = async () => {
    if (!note.trim()) return;
    const { error } = await supabase
      .from("lead_notes")
      .insert({ customer_id: customer.id, author_id: profile?.id, note });
    if (error) return toast.error(error.message);
    setNote("");
    qc.invalidateQueries({ queryKey: ["lead-notes", customer.id] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              {customer.phone ?? "—"}
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {customer.email ?? "—"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Lead status</Label>
              <Select
                defaultValue={customer.lead_status}
                onValueChange={(v) => updateField("lead_status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {LEAD_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Assigned sales owner</Label>
              <Select
                defaultValue={customer.assigned_sales_owner ?? undefined}
                onValueChange={(v) => updateField("assigned_sales_owner", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {staff?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Referral source</Label>
            <Input
              defaultValue={customer.referral_source ?? ""}
              onBlur={(e) => updateField("referral_source", e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs">Notes</Label>
            <div className="flex gap-2">
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note…"
              />
              <Button size="sm" onClick={addNote}>
                Add
              </Button>
            </div>
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {notes?.map((n) => (
                <div key={n.id} className="rounded-lg border border-border p-2.5 text-sm">
                  <p>{n.note}</p>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {n.profiles?.full_name ?? "System"} · {formatDateTime(n.created_at)}
                  </div>
                </div>
              ))}
              {!notes?.length && <p className="text-xs text-muted-foreground">No notes yet.</p>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KanbanBoard() {
  const { data: customers, isLoading } = useCustomers();

  return (
    <div className="grid gap-4 overflow-x-auto pb-2 lg:grid-cols-5">
      {LEAD_STAGES.map((stage) => {
        const items = customers?.filter((c) => c.lead_status === stage) ?? [];
        return (
          <div key={stage} className="min-w-[240px] rounded-xl border border-border bg-card/60 p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold">{LEAD_LABELS[stage]}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {items.length}
              </span>
            </div>
            <div className="space-y-2">
              {isLoading && <p className="px-1 text-xs text-muted-foreground">Loading…</p>}
              {items.map((c) => (
                <CustomerDialog
                  key={c.id}
                  customer={c}
                  trigger={
                    <button className="w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm transition hover:shadow-card">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-primary/15 text-[10px] text-primary">
                            {initials(c.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{c.name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {c.profiles?.full_name ?? "Unassigned"}
                          </div>
                        </div>
                      </div>
                      {c.referral_source && (
                        <div className="mt-2 truncate text-[11px] text-muted-foreground">
                          via {c.referral_source}
                        </div>
                      )}
                    </button>
                  }
                />
              ))}
              {!isLoading && !items.length && (
                <p className="px-1 text-xs text-muted-foreground">No leads</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------- Site visits ------------------------------- */

function ScheduleVisitDialog() {
  const [open, setOpen] = useState(false);
  const { data: customers } = useCustomers();
  const { data: staff } = useSalesStaff();
  const { data: projects } = useQuery({
    queryKey: ["projects-brief"],
    queryFn: async () => (await supabase.from("projects").select("id, name")).data ?? [],
  });
  const qc = useQueryClient();
  const [form, setForm] = useState({
    customer_id: "",
    project_id: "",
    scheduled_date: "",
    assigned_staff: "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.customer_id || !form.project_id || !form.scheduled_date)
      return toast.error("Fill in customer, project and date");
    setSaving(true);
    const { error } = await supabase.from("site_visits").insert({
      customer_id: form.customer_id,
      project_id: form.project_id,
      scheduled_date: new Date(form.scheduled_date).toISOString(),
      assigned_staff: form.assigned_staff || null,
      status: "scheduled",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Site visit scheduled");
    qc.invalidateQueries({ queryKey: ["site-visits"] });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground">
          <Plus className="mr-1.5 h-4 w-4" />
          Schedule visit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule a site visit</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block text-xs">Customer</Label>
            <Select onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Project</Label>
            <Select onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Date &amp; time</Label>
            <Input
              type="datetime-local"
              value={form.scheduled_date}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Assigned staff</Label>
            <Select onValueChange={(v) => setForm((f) => ({ ...f, assigned_staff: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select staff" />
              </SelectTrigger>
              <SelectContent>
                {staff?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
            {saving ? "Saving…" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type SiteVisitRow = SiteVisit & {
  customers: { name: string } | null;
  projects: { name: string } | null;
  profiles: { full_name: string | null } | null;
};

function SiteVisitsTab() {
  const qc = useQueryClient();
  const { data: visits, isLoading } = useQuery({
    queryKey: ["site-visits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_visits")
        .select("*, customers(name), projects(name), profiles:assigned_staff(full_name)")
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return data as SiteVisitRow[];
    },
  });

  const setOutcome = async (id: string, status: SiteVisitStatus) => {
    const { error } = await supabase.from("site_visits").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["site-visits"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ScheduleVisitDialog />
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Update</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visits?.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.customers?.name}</TableCell>
                <TableCell className="text-muted-foreground">{v.projects?.name}</TableCell>
                <TableCell className="flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDateTime(v.scheduled_date)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {v.profiles?.full_name ?? "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={v.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Select
                    value={v.status}
                    onValueChange={(val) => setOutcome(v.id, val as SiteVisitStatus)}
                  >
                    <SelectTrigger className="ml-auto w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="no_show">No show</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function LeadsCrm() {
  return (
    <div>
      <PageHeader
        title="Leads & CRM"
        desc="Track every lead from first contact to sold, and manage site visits."
      />
      <div className="p-4 md:p-8">
        <Tabs defaultValue="pipeline">
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="visits">Site visits</TabsTrigger>
          </TabsList>
          <TabsContent value="pipeline" className="mt-4">
            <KanbanBoard />
          </TabsContent>
          <TabsContent value="visits" className="mt-4">
            <SiteVisitsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
