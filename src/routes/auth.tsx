import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SAN Connect" },
      { name: "description", content: "Sign in to your SAN Connect account." },
    ],
  }),
  component: AuthPage,
});

const DEMO_ACCOUNTS = [
  { email: "admin@sanconnect.demo", label: "Admin" },
  { email: "sales1@sanconnect.demo", label: "Sales" },
  { email: "finance@sanconnect.demo", label: "Finance" },
  { email: "legal@sanconnect.demo", label: "Legal" },
  { email: "customer1@sanconnect.demo", label: "Customer (booked plot, overdue installment)" },
  { email: "customer2@sanconnect.demo", label: "Customer (fully sold, possession complete)" },
  { email: "customer4@sanconnect.demo", label: "Customer (booked flat, rejected document)" },
];

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showDemo, setShowDemo] = useState(false);

  const routeAfterLogin = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return navigate({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();
    navigate({ to: profile?.role === "customer" || !profile ? "/portal" : "/admin" });
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    toast.success("Welcome back");
    await routeAfterLogin();
    setLoading(false);
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/portal",
        data: { role: "customer", full_name: fullName || email.split("@")[0], phone },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — welcome to SAN Connect");
    navigate({ to: "/portal" });
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute inset-0 bg-hero-gradient" />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="mb-8">
          <Logo />
        </div>

        <div className="rounded-2xl border border-border bg-card-gradient p-6 shadow-card">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="mt-4 space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Password</Label>
                    <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground"
                  disabled={loading}
                >
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={signUp} className="mt-4 space-y-4">
                <p className="text-xs text-muted-foreground">
                  New customer accounts get instant access to browse properties, book and track your
                  purchase.
                </p>
                <div>
                  <Label>Full name</Label>
                  <Input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98765 43210"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground"
                  disabled={loading}
                >
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setShowDemo((v) => !v)}
              className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
            >
              <span>Demo logins (password: SanConnect@123)</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showDemo ? "rotate-180" : ""}`}
              />
            </button>
            {showDemo && (
              <ul className="mt-3 space-y-1.5 text-xs">
                {DEMO_ACCOUNTS.map((a) => (
                  <li key={a.email}>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(a.email);
                        setPassword("SanConnect@123");
                      }}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-muted"
                    >
                      <span className="font-mono text-[11px]">{a.email}</span>
                      <span className="text-muted-foreground">{a.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
