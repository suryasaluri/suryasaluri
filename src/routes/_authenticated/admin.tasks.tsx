import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { useProfile } from "@/lib/useProfile";
import type { TaskStatus, Task, Commission } from "@/lib/db-types";
import { toast } from "sonner";
import { Plus, ListTodo } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/tasks")({
  component: TeamTasks,
});

type TaskRow = Task & {
  projects: { name: string } | null;
  customers: { name: string } | null;
  assignee: { full_name: string | null } | null;
};

function useTasks() {
  return useQuery({
    queryKey: ["admin-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(name), customers(name), assignee:assigned_to(full_name)")
        .order("due_date");
      if (error) throw error;
      return data as TaskRow[];
    },
  });
}

function NewTaskDialog() {
  const [open, setOpen] = useState(false);
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    description: "",
    project_id: "",
    customer_id: "",
    assigned_to: "",
    due_date: "",
  });
  const [saving, setSaving] = useState(false);

  const { data: projects } = useQuery({
    queryKey: ["projects-brief2"],
    queryFn: async () => (await supabase.from("projects").select("id, name")).data ?? [],
  });
  const { data: customers } = useQuery({
    queryKey: ["customers-brief2"],
    queryFn: async () => (await supabase.from("customers").select("id, name")).data ?? [],
  });
  const { data: staff } = useQuery({
    queryKey: ["all-staff"],
    queryFn: async () =>
      (await supabase.from("profiles").select("*").neq("role", "customer")).data ?? [],
  });

  const save = async () => {
    if (!form.title || !form.assigned_to) return toast.error("Title and assignee are required");
    setSaving(true);
    const { error } = await supabase.from("tasks").insert({
      title: form.title,
      description: form.description || null,
      project_id: form.project_id || null,
      customer_id: form.customer_id || null,
      assigned_to: form.assigned_to,
      due_date: form.due_date || null,
      created_by: profile?.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Task created");
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground">
          <Plus className="mr-1.5 h-4 w-4" />
          New task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block text-xs">Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Description</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Project (optional)</Label>
              <Select onValueChange={(v) => setForm({ ...form, project_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
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
              <Label className="mb-1.5 block text-xs">Lead/customer (optional)</Label>
              <Select onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Assign to</Label>
              <Select onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
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
            <div>
              <Label className="mb-1.5 block text-xs">Due date</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
            {saving ? "Saving…" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TasksTab() {
  const { data: tasks, isLoading } = useTasks();
  const qc = useQueryClient();

  const updateStatus = async (id: string, status: TaskStatus) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NewTaskDialog />
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && !tasks?.length && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <ListTodo className="h-8 w-8" />
            No tasks yet.
          </CardContent>
        </Card>
      )}
      <div className="grid gap-3">
        {tasks?.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="font-medium">{t.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t.assignee?.full_name ?? "Unassigned"}
                  {t.projects?.name ? ` · ${t.projects.name}` : ""}
                  {t.customers?.name ? ` · ${t.customers.name}` : ""}
                  {t.due_date ? ` · Due ${formatDate(t.due_date)}` : ""}
                </div>
                {t.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                )}
              </div>
              <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v as TaskStatus)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To do</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

type CommissionRow = Commission & {
  customers: { name: string } | null;
  properties: { code: string } | null;
  staff: { full_name: string | null } | null;
};

function CommissionsTab() {
  const qc = useQueryClient();
  const { data: commissions, isLoading } = useQuery({
    queryKey: ["admin-commissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commissions")
        .select("*, customers(name), properties(code), staff:sales_staff_id(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CommissionRow[];
    },
  });

  const markPaid = async (id: string) => {
    const { error } = await supabase.from("commissions").update({ status: "paid" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked as paid");
    qc.invalidateQueries({ queryKey: ["admin-commissions"] });
  };

  return (
    <div className="space-y-4">
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sales staff</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commissions?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.staff?.full_name}</TableCell>
                <TableCell>{c.customers?.name}</TableCell>
                <TableCell>{c.properties?.code}</TableCell>
                <TableCell>{c.rate_percent}%</TableCell>
                <TableCell>{formatCurrency(c.amount)}</TableCell>
                <TableCell>
                  <StatusBadge status={c.status} />
                </TableCell>
                <TableCell className="text-right">
                  {c.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => markPaid(c.id)}>
                      Mark paid
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function TeamTasks() {
  return (
    <div>
      <PageHeader
        title="Team & Task Management"
        desc="Lightweight task assignment and commission tracking for sales staff."
      />
      <div className="p-4 md:p-8">
        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
          </TabsList>
          <TabsContent value="tasks" className="mt-4">
            <TasksTab />
          </TabsContent>
          <TabsContent value="commissions" className="mt-4">
            <CommissionsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
