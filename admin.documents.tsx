import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { DOC_TYPE_LABELS } from "@/lib/db-types";
import type { Document } from "@/lib/db-types";
import { formatDate } from "@/lib/format";
import { useProfile } from "@/lib/useProfile";
import { toast } from "sonner";
import { FileText, Check, X, Download, Search, User, Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/documents")({
  component: DocumentCenter,
});

type DocRow = Document & {
  customers: { name: string } | null;
  properties: { code: string } | null;
  verifier: { full_name: string | null } | null;
};

function useDocuments() {
  return useQuery({
    queryKey: ["admin-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, customers(name), properties(code), verifier:verified_by(full_name)")
        .order("upload_date", { ascending: false });
      if (error) throw error;
      return data as DocRow[];
    },
  });
}

async function openDocument(fileUrl: string) {
  if (fileUrl.startsWith("http")) return window.open(fileUrl, "_blank");
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(fileUrl, 60);
  if (error || !data) return toast.error("Couldn't open document");
  window.open(data.signedUrl, "_blank");
}

function ReviewDialog({
  doc,
  trigger,
  decision,
}: {
  doc: DocRow;
  trigger: React.ReactNode;
  decision: "verified" | "rejected";
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: profile } = useProfile();
  const qc = useQueryClient();

  const submit = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("documents")
      .update({
        verification_status: decision,
        verifier_notes: notes || null,
        verified_by: profile?.id,
        verified_at: new Date().toISOString(),
      })
      .eq("id", doc.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(decision === "verified" ? "Document verified" : "Document rejected");
    qc.invalidateQueries({ queryKey: ["admin-documents"] });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{decision === "verified" ? "Verify" : "Reject"} document</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {doc.file_name} — {doc.customers?.name}
          </p>
          <div>
            <Label className="mb-1.5 block text-xs">
              {decision === "rejected" ? "Reason for rejection (required)" : "Notes (optional)"}
            </Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={saving || (decision === "rejected" && !notes.trim())}
            className={
              decision === "verified"
                ? "bg-success text-success-foreground hover:opacity-90"
                : "bg-destructive text-destructive-foreground hover:opacity-90"
            }
          >
            {saving
              ? "Saving…"
              : decision === "verified"
                ? "Confirm verification"
                : "Confirm rejection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QueueTab() {
  const { data: documents, isLoading } = useDocuments();
  const [search, setSearch] = useState("");
  const [docType, setDocType] = useState("all");

  const pending = useMemo(
    () =>
      (documents ?? []).filter((d) => {
        if (d.verification_status !== "pending") return false;
        if (docType !== "all" && d.doc_type !== docType) return false;
        if (search && !d.customers?.name?.toLowerCase().includes(search.toLowerCase()))
          return false;
        return true;
      }),
    [documents, search, docType],
  );

  const groups = useMemo(() => {
    const byCustomer = new Map<string, { name: string; docs: DocRow[] }>();
    for (const d of pending) {
      const key = d.customer_id;
      if (!byCustomer.has(key)) byCustomer.set(key, { name: d.customers?.name ?? "—", docs: [] });
      byCustomer.get(key)!.docs.push(d);
    }
    return Array.from(byCustomer.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [pending]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Search customer</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="min-w-[180px]">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Document type</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          {pending.length} pending
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && !pending.length && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8" />
            Queue is clear — nothing pending verification.
          </CardContent>
        </Card>
      )}
      {groups.map((g) => (
        <Card key={g.name}>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold">{g.name}</span>
              <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                {g.docs.length} document{g.docs.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="divide-y divide-border">
              {g.docs.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{d.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {DOC_TYPE_LABELS[d.doc_type]}
                        {d.properties?.code ? ` · ${d.properties.code}` : ""} ·{" "}
                        {formatDate(d.upload_date)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openDocument(d.file_url)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <ReviewDialog
                      doc={d}
                      decision="rejected"
                      trigger={
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-destructive/40 text-destructive hover:bg-destructive/10"
                        >
                          <X className="mr-1.5 h-3.5 w-3.5" />
                          Reject
                        </Button>
                      }
                    />
                    <ReviewDialog
                      doc={d}
                      decision="verified"
                      trigger={
                        <Button
                          size="sm"
                          className="bg-success text-success-foreground hover:opacity-90"
                        >
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                          Verify
                        </Button>
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DocTable({ docs }: { docs: DocRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>File</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Verified by</TableHead>
          <TableHead>Notes</TableHead>
          <TableHead className="text-right">View</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {docs.map((d) => (
          <TableRow key={d.id}>
            <TableCell className="font-medium">{d.customers?.name}</TableCell>
            <TableCell>{DOC_TYPE_LABELS[d.doc_type]}</TableCell>
            <TableCell className="max-w-[160px] truncate">{d.file_name}</TableCell>
            <TableCell>
              <StatusBadge status={d.verification_status} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {d.verifier?.full_name ?? "—"}
              {d.verified_at ? ` · ${formatDate(d.verified_at)}` : ""}
            </TableCell>
            <TableCell className="max-w-[220px] truncate text-muted-foreground">
              {d.verifier_notes ?? "—"}
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="icon" onClick={() => openDocument(d.file_url)}>
                <Download className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type GroupMode = "flat" | "customer" | "asset";

function AllDocumentsTab() {
  const { data: documents, isLoading } = useDocuments();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [groupBy, setGroupBy] = useState<GroupMode>("flat");

  const filtered = useMemo(
    () =>
      (documents ?? []).filter((d) => {
        if (status !== "all" && d.verification_status !== status) return false;
        if (search && !d.customers?.name?.toLowerCase().includes(search.toLowerCase()))
          return false;
        return true;
      }),
    [documents, search, status],
  );

  const grouped = useMemo(() => {
    if (groupBy === "flat") return [];
    const map = new Map<string, { label: string; docs: DocRow[] }>();
    for (const d of filtered) {
      const key = groupBy === "customer" ? d.customer_id : (d.property_id ?? "__none__");
      const label =
        groupBy === "customer"
          ? (d.customers?.name ?? "—")
          : (d.properties?.code ?? "No linked asset");
      if (!map.has(key)) map.set(key, { label, docs: [] });
      map.get(key)!.docs.push(d);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, groupBy]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Search customer</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="min-w-[160px]">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">View by</Label>
          <div className="flex rounded-lg border border-border p-0.5">
            {(
              [
                { v: "flat", label: "All", icon: FileText },
                { v: "customer", label: "Customer", icon: User },
                { v: "asset", label: "Asset", icon: Building2 },
              ] as const
            ).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setGroupBy(opt.v)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition ${
                  groupBy === opt.v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <opt.icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {groupBy === "flat" && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <DocTable docs={filtered} />
        </div>
      )}

      {groupBy !== "flat" && (
        <div className="space-y-3">
          {!isLoading && !grouped.length && (
            <p className="text-sm text-muted-foreground">No documents match your filters.</p>
          )}
          {grouped.map((g) => (
            <Card key={g.label}>
              <CardContent className="p-0">
                <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                  {groupBy === "customer" ? (
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold">{g.label}</span>
                  <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                    {g.docs.length} document{g.docs.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <DocTable docs={g.docs} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentCenter() {
  return (
    <div>
      <PageHeader
        title="Document Center"
        desc="Verify uploaded documents and keep a full audit trail per customer."
      />
      <div className="p-4 md:p-8">
        <Tabs defaultValue="queue">
          <TabsList>
            <TabsTrigger value="queue">Verification queue</TabsTrigger>
            <TabsTrigger value="all">All documents</TabsTrigger>
          </TabsList>
          <TabsContent value="queue" className="mt-4">
            <QueueTab />
          </TabsContent>
          <TabsContent value="all" className="mt-4">
            <AllDocumentsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
