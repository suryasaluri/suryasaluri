import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMyCustomer } from "@/lib/useProfile";

export const Route = createFileRoute("/_authenticated/portal/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: customer } = useMyCustomer();
  const qc = useQueryClient();
  const [optIn, setOptIn] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!customer) return;
    setOptIn(customer.whatsapp_opt_in);
    setPhone(customer.phone ?? "");
  }, [customer]);

  const save = async () => {
    if (!customer) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("customers")
        .update({ whatsapp_opt_in: optIn, phone })
        .eq("id", customer.id);
      if (error) throw error;
      toast.success("Notification preferences saved");
      qc.invalidateQueries({ queryKey: ["my-customer"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save your preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage how SAN Connect keeps you updated.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success/15 text-success">
            <MessageCircle className="h-5 w-5" />
          </span>
          <CardTitle className="text-base">WhatsApp updates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Send me updates on WhatsApp</div>
              <p className="text-xs text-muted-foreground">
                Payment reminders, document status and booking milestones from our AI assistant.
              </p>
            </div>
            <Switch checked={optIn} onCheckedChange={setOptIn} />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp number</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98765 43210"
              disabled={!optIn}
            />
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
