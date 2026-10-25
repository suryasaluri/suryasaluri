import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { formatCurrency, formatDate } from "@/lib/format";
import { INDIAN_BANKS } from "@/lib/db-types";

export function LoanApplicationDialog({
  customerId,
  propertyId,
  suggestedAmount,
}: {
  customerId: string;
  propertyId: string;
  suggestedAmount: number;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bank, setBank] = useState<string>("");
  const [amount, setAmount] = useState(String(Math.round(suggestedAmount * 0.8)));
  const [submitting, setSubmitting] = useState(false);

  const { data: applications } = useQuery({
    queryKey: ["loan-applications", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submit = async () => {
    if (!bank) return toast.error("Choose a bank to continue");
    const requested = Number(amount);
    if (!requested || requested <= 0) return toast.error("Enter a valid loan amount");

    setSubmitting(true);
    try {
      const { error } = await supabase.from("loan_applications").insert({
        customer_id: customerId,
        property_id: propertyId,
        bank_name: bank,
        requested_amount: requested,
      });
      if (error) throw error;
      toast.success(`Loan application sent to ${bank}. They'll reach out to you shortly.`);
      qc.invalidateQueries({ queryKey: ["loan-applications", propertyId] });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't submit the application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Landmark className="mr-2 h-4 w-4" /> Apply for home loan financing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply for financing</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Bank / lender</Label>
            <Select value={bank} onValueChange={setBank}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a bank" />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_BANKS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Loan amount requested</Label>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Suggested: up to 80% of property value ({formatCurrency(suggestedAmount * 0.8)}).
            </p>
          </div>

          {!!applications?.length && (
            <div className="rounded-lg border border-border">
              <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                Previous applications
              </div>
              <div className="max-h-32 space-y-2 overflow-y-auto p-3">
                {applications.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">
                      {a.bank_name} · {formatCurrency(a.requested_amount)} ·{" "}
                      {formatDate(a.created_at)}
                    </span>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={submitting} className="w-full sm:w-auto">
            {submitting ? "Submitting…" : "Submit application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
