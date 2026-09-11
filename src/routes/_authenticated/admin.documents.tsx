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
import { FileText, Check, X, Download, Search } from "lucide-react";

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
  const pending = documents?.filter((d) => d.verification_status === "pending") ?? [];

  return (
    <div className="space-y-3">
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && !pending.length && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8" />
            Queue is clear — nothing pending verification.
          </CardContent>
        </Card>
      )}
      {pending.map((d) => (
        <Card key={d.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{d.file_name}</div>
                <div className="text-xs text-muted-foreground">
                  {d.customers?.name} · {DOC_TYPE_LABELS[d.doc_type]}
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
                  <Button size="sm" className="bg-success text-success-foreground hover:opacity-90">
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Verify
                  </Button>
                }
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AllDocumentsTab() {
  const { data: documents, isLoading } = useDocuments();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

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
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="overflow-x-auto rounded-xl border border-border">
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
            {filtered.map((d) => (
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
      </div>
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
