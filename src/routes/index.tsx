import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import {
  MapPin,
  ArrowRight,
  CheckCircle2,
  Building2,
  Trees,
  ShieldCheck,
  FileCheck2,
  Wallet,
  ClipboardCheck,
  Users,
  LayoutGrid,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SAN Connect — Real Estate Sales & Operations Platform" },
      {
        name: "description",
        content:
          "Browse plots and flats, track your booking, payments and documents — all in one place with SAN Connect.",
      },
    ],
  }),
  component: Landing,
});

function useFeaturedProjects() {
  return useQuery({
    queryKey: ["landing-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at")
        .limit(3);
      if (error) throw error;
      return data;
    },
  });
}

function Landing() {
  const { data: projects } = useFeaturedProjects();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/">
            <Logo />
          </Link>
          <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
            <a href="#projects" className="hover:text-foreground">
              Projects
            </a>
            <a href="#how-it-works" className="hover:text-foreground">
              How it works
            </a>
            <a href="#platform" className="hover:text-foreground">
              For our team
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="bg-primary text-primary-foreground hover:opacity-90">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute inset-0 bg-hero-gradient" />
        <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-primary" />
            </span>
            Plots &amp; Flats · One unified platform
          </div>
          <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight tracking-tight md:text-6xl">
            Your land. Your home. <span className="text-primary">One connected journey.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            From browsing a plot or flat to booking, payments, document verification and possession
            — SAN Connect keeps you and our team on the same page, every step of the way.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground shadow-glow hover:opacity-90"
              >
                Browse properties <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button size="lg" variant="outline">
                How it works
              </Button>
            </a>
          </div>
          <div className="mt-14 grid grid-cols-2 gap-6 text-left md:grid-cols-4 md:gap-8">
            {[
              { k: "Active projects", v: "3", sub: "Plots, flats & mixed layouts" },
              { k: "Inventory tracked", v: "25", sub: "Live availability status" },
              { k: "Approval stages", v: "5", sub: "Booking to possession" },
              { k: "Portal access", v: "24×7", sub: "From any device" },
            ].map((s) => (
              <div key={s.k} className="rounded-xl border border-border bg-card-gradient p-5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.k}</div>
                <div className="mt-2 font-display text-2xl font-bold text-primary">{s.v}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="projects" className="border-t border-border py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <div className="text-xs font-mono uppercase tracking-widest text-primary">
              Featured developments
            </div>
            <h2 className="mt-3 text-4xl font-bold">Explore our current projects</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {(projects ?? []).map((p) => (
              <div
                key={p.id}
                className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:-translate-y-1 hover:shadow-glow"
              >
                <div
                  className="h-44 w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${p.cover_image_url})` }}
                />
                <div className="p-5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {p.location}
                  </div>
                  <h3 className="mt-1.5 text-lg font-semibold">{p.name}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground capitalize">
                      {p.type_mix === "both" ? "Plots & Flats" : p.type_mix}
                    </span>
                    <Link
                      to="/auth"
                      className="text-sm font-medium text-primary group-hover:underline"
                    >
                      View details →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-t border-border bg-card/40 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <div className="text-xs font-mono uppercase tracking-widest text-primary">
              Customer journey
            </div>
            <h2 className="mt-3 text-4xl font-bold">
              Everything tracked, nothing lost in translation
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-5">
            {[
              {
                icon: LayoutGrid,
                label: "Browse",
                desc: "Filter plots & flats by budget, size and location.",
              },
              {
                icon: CheckCircle2,
                label: "Book",
                desc: "Express interest and lock in a property instantly.",
              },
              { icon: Wallet, label: "Pay", desc: "Track your installment schedule and dues." },
              {
                icon: FileCheck2,
                label: "Verify",
                desc: "Upload KYC & legal documents, see their status.",
              },
              {
                icon: ClipboardCheck,
                label: "Possess",
                desc: "Follow booking through to registration & handover.",
              },
            ].map((s, i) => (
              <div
                key={s.label}
                className="relative rounded-xl border border-border bg-card p-5 text-center shadow-card"
              >
                <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">STEP {i + 1}</div>
                <div className="mt-1 font-semibold">{s.label}</div>
                <p className="mt-1.5 text-xs text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="platform" className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-primary">
                For our sales, finance & legal teams
              </div>
              <h2 className="mt-3 text-4xl font-bold">
                One operations dashboard, built for real estate
              </h2>
              <p className="mt-4 text-muted-foreground">
                Sales tracks leads and site visits, finance manages collections and overdue
                accounts, legal verifies documents and clears approvals — admin sees it all, with
                reports rolled up automatically.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Kanban pipeline from New lead to Sold",
                  "Installment schedules with automatic overdue flags",
                  "Document verification queue with audit trail",
                  "Multi-stage approval board across booking → possession",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="mt-8 inline-block">
                <Button className="bg-primary text-primary-foreground hover:opacity-90">
                  Staff sign in <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Building2, label: "Inventory", sub: "Plots & flats, live status" },
                { icon: Users, label: "Leads & CRM", sub: "Pipeline + site visits" },
                { icon: Wallet, label: "Finance", sub: "Collections & dues" },
                { icon: ShieldCheck, label: "Legal", sub: "Docs & approvals" },
              ].map((c) => (
                <div
                  key={c.label}
                  className="rounded-xl border border-border bg-card-gradient p-6 shadow-card"
                >
                  <c.icon className="h-6 w-6 text-primary" />
                  <div className="mt-3 font-semibold">{c.label}</div>
                  <div className="text-xs text-muted-foreground">{c.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Trees className="mx-auto mb-4 h-8 w-8 text-primary" />
          <h2 className="text-4xl font-bold">Find your plot. Build your future.</h2>
          <p className="mt-4 text-muted-foreground">
            Sign in to browse live inventory and track your journey end to end.
          </p>
          <Link to="/auth">
            <Button size="lg" className="mt-8 bg-primary text-primary-foreground shadow-glow">
              Get started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © 2026 SAN Connect — Real Estate Sales &amp; Operations Platform
      </footer>
    </div>
  );
}
