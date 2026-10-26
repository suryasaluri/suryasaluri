import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Ticket as TicketIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useMyCustomer } from "@/lib/useProfile";
import { useComplex, useMyResident } from "@/lib/useFM";
import { formatDateTime } from "@/lib/format";
import {
  TICKET_CATEGORY_LABELS,
  type MaintenanceTicket,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/fm/tickets")({
  component: Tickets,
});

const CATEGORIES = Object.keys(TICKET_CATEGORY_LABELS) as TicketCategory[];
const PRIORITIES: TicketPriority[] = ["low", "medium", "high", "urgent"];
const STATUSES: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];

function useTickets(
  complexId: string | undefined,
  staffView: boolean,
  customerId: string | undefined,
) {
  return useQuery({
    queryKey: ["fm-tickets", complexId, staffView, customerId],
    enabled: !!complexId && (staffView || !!customerId),
    queryFn: async (): Promise<MaintenanceTicket[]> => {
      let query = supabase
        .from("maintenance_tickets")
        .select("*")
        .eq("complex_id", complexId!)
        .order("created_at", { ascending: false });
      if (!staffView) query = query.eq("customer_id", customerId!);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

function RaiseTicketDialog({
  complexId,
  residentId,
  customerId,
}: {
  complexId: string;
  residentId: string;
  customerId: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<TicketCategory>("plumbing");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim()) return toast.error("Give the ticket a short title");
    setSubmitting(true);
    try {
      const { error } = await supabase.from("maintenance_tickets").insert({
        complex_id: complexId,
        resident_id: residentId,
        customer_id: customerId,
        category,
        priority,
        title: title.trim(),
        description: description.trim() || null,
      });
      if (error) throw error;
      toast.success("Ticket raised — the facility team has been notified");
      setTitle("");
      setDescription("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["fm-tickets"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't raise the ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1.5 h-4 w-4" /> Raise a ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Raise a maintenance ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {TICKET_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kitchen tap leaking"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any extra detail that helps the team diagnose it"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={submitting} className="w-full sm:w-auto">
            {submitting ? "Submitting…" : "Submit ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TicketRow({ ticket, staffView }: { ticket: MaintenanceTicket; staffView: boolean }) {
  const qc = useQueryClient();
  const [vendor, setVendor] = useState(ticket.assigned_vendor ?? "");

  const updateStatus = async (status: TicketStatus) => {
    const { error } = await supabase
      .from("maintenance_tickets")
      .update({
        status,
        resolved_at: status === "resolved" || status === "closed" ? new Date().toISOString() : null,
      })
      .eq("id", ticket.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["fm-tickets"] });
  };

  const saveVendor = async () => {
    if (vendor === (ticket.assigned_vendor ?? "")) return;
    const { error } = await supabase
      .from("maintenance_tickets")
      .update({ assigned_vendor: vendor.trim() || null })
      .eq("id", ticket.id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["fm-tickets"] });
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{ticket.title}</span>
          <StatusBadge status={ticket.status} />
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
            {ticket.priority} priority
          </span>
          <span className="text-[10px] text-muted-foreground">
            {TICKET_CATEGORY_LABELS[ticket.category]}
          </span>
        </div>
        {ticket.description && (
          <p className="mt-1 text-xs text-muted-foreground">{ticket.description}</p>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground">
          Raised {formatDateTime(ticket.created_at)}
        </p>
      </div>
      {staffView && (
        <div className="flex shrink-0 flex-col gap-2 sm:w-48">
          <Select value={ticket.status} onValueChange={(v) => updateStatus(v as TicketStatus)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs capitalize">
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            onBlur={saveVendor}
            placeholder="Assign vendor"
            className="h-8 text-xs"
          />
        </div>
      )}
    </div>
  );
}

function Tickets() {
  const { data: profile } = useProfile();
  const { data: complex } = useComplex();
  const { data: customer } = useMyCustomer();
  const { data: resident } = useMyResident();
  const staffView = profile ? profile.role !== "customer" : false;
  const { data: tickets, isLoading } = useTickets(complex?.id, staffView, customer?.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">
            {staffView ? "Maintenance Tickets" : "My Tickets"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {staffView
              ? "Every open and resolved ticket across the complex."
              : "Report an issue in your unit or a common area."}
          </p>
        </div>
        {!staffView && resident && customer && (
          <RaiseTicketDialog
            complexId={resident.complex_id}
            residentId={resident.id}
            customerId={customer.id}
          />
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && !tickets?.length && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <TicketIcon className="h-8 w-8" />
            No tickets yet.
          </CardContent>
        </Card>
      )}

      {!!tickets?.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tickets.length} ticket(s)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tickets.map((t) => (
              <TicketRow key={t.id} ticket={t} staffView={staffView} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
