import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Nexus Command" }, { name: "description", content: "Set a new password for your Nexus Command account." }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    // Supabase recovery link sets a session via the URL hash; wait for it.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/app" });
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
          <h1 className="text-xl font-semibold">Set a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose a strong password you haven't used before.</p>
          {!ready ? (
            <p className="mt-6 text-sm text-muted-foreground">Verifying your reset link…</p>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div><Label>New password</Label><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <div><Label>Confirm password</Label><Input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={loading}>Update password</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
