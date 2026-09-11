import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCustomer } from "@/lib/useProfile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import { DOC_TYPE_LABELS } from "@/lib/db-types";
import type { DocumentType, Document } from "@/lib/db-types";
import { toast } from "sonner";
import { FileText, Upload, Download, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/documents")({
  component: MyDocuments,
});

async function openDocument(fileUrl: string) {
  if (fileUrl.startsWith("http")) return window.open(fileUrl, "_blank");
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(fileUrl, 60);
  if (error || !data) return toast.error("Couldn't open document");
  window.open(data.signedUrl, "_blank");
}

function UploadDialog({
  customerId,
  propertyOptions,
}: {
  customerId: string;
  propertyOptions: { id: string; code: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState<DocumentType>("id_proof");
  const [propertyId, setPropertyId] = useState<string>("none");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  const submit = async () => {
    if (!file) return toast.error("Choose a file to upload");
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const path = `${userData.user!.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("documents").insert({
        customer_id: customerId,
        property_id: propertyId === "none" ? null : propertyId,
        doc_type: docType,
        file_name: file.name,
        file_url: path,
        uploaded_by: userData.user!.id,
        verification_status: "pending",
      });
      if (insertError) throw insertError;
      toast.success("Document uploaded — awaiting verification");
      qc.invalidateQueries({ queryKey: ["my-documents", customerId] });
      setOpen(false);
      setFile(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground">
          <Upload className="mr-1.5 h-4 w-4" />
          Upload document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Document type</Label>
            <Select value={docType} onValueChange={(v) => setDocType(v as DocumentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="id_proof">ID Proof</SelectItem>
                <SelectItem value="kyc">KYC Document</SelectItem>
                <SelectItem value="sale_agreement">Sale Agreement</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {propertyOptions.length > 0 && (
            <div>
              <Label className="mb-1.5 block">Related property (optional)</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not property specific</SelectItem>
                  {propertyOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="mb-1.5 block">File</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={uploading}
            className="bg-primary text-primary-foreground"
          >
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MyDocuments() {
  const { data: customer } = useMyCustomer();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["my-documents", customer?.id],
    enabled: !!customer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, properties(code)")
        .eq("customer_id", customer!.id)
        .order("upload_date", { ascending: false });
      if (error) throw error;
      return data as (Document & { properties: { code: string } | null })[];
    },
  });

  const { data: properties } = useQuery({
    queryKey: ["my-properties-brief", customer?.id],
    enabled: !!customer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, code")
        .eq("customer_id", customer!.id);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">My Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View documents shared with you and upload requested KYC/ID proofs.
          </p>
        </div>
        {customer && <UploadDialog customerId={customer.id} propertyOptions={properties ?? []} />}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && !documents?.length && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8" /> No documents yet.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {documents?.map((d) => (
          <Card key={d.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{d.file_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {DOC_TYPE_LABELS[d.doc_type]}
                    {d.properties?.code ? ` · ${d.properties.code}` : ""} ·{" "}
                    {formatDate(d.upload_date)}
                  </div>
                  {d.verification_status === "rejected" && d.verifier_notes && (
                    <div className="mt-1 flex items-start gap-1 text-xs text-destructive">
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                      {d.verifier_notes}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={d.verification_status} />
                <Button variant="ghost" size="icon" onClick={() => openDocument(d.file_url)}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
