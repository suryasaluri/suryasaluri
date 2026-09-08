import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — Nexus Command" }, { name: "description", content: "Reset your Nexus Command password." }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Reset link sent — check your email");
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute inset-0 bg-hero-gradient" />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <Link to="/auth" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link>
        <div className="mb-8 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-gradient text-primary-foreground"><Database className="h-4 w-4" /></div>
          <span className="font-display text-xl font-bold">Nexus <span className="text-primary">Command</span></span>
        </div>
        <div className="rounded-2xl border border-border bg-card-gradient p-6 shadow-card">
          <h1 className="text-xl font-semibold">Forgot your password?</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your email and we'll send you a secure link to reset it.</p>
          {sent ? (
            <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4 text-sm">
              If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way. The link expires in 1 hour.
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={loading}>Send reset link</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
