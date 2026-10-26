import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { HeroBackground } from "@/components/HeroBackground";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/lib/useSiteSettings";
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
  Sparkles,
  TrendingDown,
  Clock,
  FileSearch,
  Quote,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SAN Connect — Real Estate Sales & Operations Platform" },
      {
        name: "description",
        content:
          "The subscription platform real estate companies run their sales, finance and legal teams on — plus a branded portal and AI assistant for every buyer.",
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

const RESULTS = [
  {
    icon: Clock,
    metric: "↓ Faster collections",
    desc: "Automatic overdue flags and installment reminders mean fewer manual follow-up calls from your finance team.",
  },
  {
    icon: FileSearch,
    metric: "Full audit trail",
    desc: "Every document, approval and status change is timestamped and attributable — nothing lost between teams.",
  },
  {
    icon: TrendingDown,
    metric: "Fewer status calls",
    desc: "Buyers track their own booking, payments and documents in a live portal, instead of calling your sales desk.",
  },
];

const STORIES = [
  {
    quote:
      "We used to run bookings on spreadsheets across three teams. SAN Connect gave every one of our plot buyers a self-serve portal, and our finance team finally sees overdue accounts the moment they slip.",
    name: "Priya Ramesh",
    role: "Operations Head, Sanview Developers",
    result: "Unified pipeline across 3 projects",
  },
  {
    quote:
      "The approval board changed how legal and finance work together — nothing moves to registration until every stage is actually cleared, and we can see exactly who's holding things up.",
    name: "Arvind Nair",
    role: "Legal Counsel, Meridian Realty Group",
    result: "5-stage approval visibility",
  },
  {
    quote:
      "Our buyers ask the AI assistant about their installment schedule before they ever call us. It's the first thing prospects mention when they tour the portal during our sales pitch.",
    name: "Kavya Iyer",
    role: "VP Sales, Horizon Estates",
    result: "AI assistant handles routine buyer questions",
  },
];

function Landing() {
  const { data: projects } = useFeaturedProjects();
  const { data: settings } = useSiteSettings();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/">
            <Logo />
          </Link>
          <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
            <a href="#results" className="hover:text-foreground">
              Results
            </a>
            <a href="#how-it-works" className="hover:text-foreground">
              Buyer journey
            </a>
            <a href="#platform" className="hover:text-foreground">
              For your team
            </a>
            <a href="#stories" className="hover:text-foreground">
              Customer stories
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
                Request a demo
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <HeroBackground animation={settings?.hero_animation ?? "aurora"} />
        <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Subscription platform · Built for real estate sales &amp; operations teams
          </div>
          <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight tracking-tight md:text-6xl">
            Run your entire real estate business
            <span className="text-primary"> on one connected platform.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            SAN Connect is what growing developers subscribe to for their sales, finance and legal
            teams — a shared operations dashboard, plus a branded self-serve portal and AI assistant
            for every buyer. From first lead to final possession.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground shadow-glow hover:opacity-90"
              >
                See the platform <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button size="lg" variant="outline">
                See the buyer journey
              </Button>
            </a>
          </div>
          <div className="mt-14 grid grid-cols-2 gap-6 text-left md:grid-cols-4 md:gap-8">
            {[
              { k: "Teams supported", v: "Sales, Finance, Legal", sub: "One shared dashboard" },
              { k: "Approval stages", v: "5", sub: "Booking to possession" },
              { k: "Buyer portal", v: "24×7", sub: "Self-serve, any device" },
              { k: "AI assistant", v: "Built in", sub: "For buyers and your team" },
            ].map((s) => (
              <div key={s.k} className="rounded-xl border border-border bg-card-gradient p-5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.k}</div>
                <div className="mt-2 font-display text-xl font-bold text-primary">{s.v}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="results" className="border-t border-border bg-card/40 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <div className="text-xs font-mono uppercase tracking-widest text-primary">
              Why teams switch to SAN Connect
            </div>
            <h2 className="mt-3 text-4xl font-bold">Built around the outcomes that matter</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {RESULTS.map((r) => (
              <div
                key={r.metric}
                className="rounded-2xl border border-border bg-card p-6 shadow-card"
              >
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
                  <r.icon className="h-5 w-5" />
                </div>
                <div className="font-display text-lg font-bold">{r.metric}</div>
                <p className="mt-2 text-sm text-muted-foreground">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="projects" className="border-t border-border py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <div className="text-xs font-mono uppercase tracking-widest text-primary">
              See it on real inventory
            </div>
            <h2 className="mt-3 text-4xl font-bold">Live projects running on this platform</h2>
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
              What your buyers experience
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
              {
                icon: Wallet,
                label: "Pay",
                desc: "Track installment schedule and apply for financing.",
              },
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
                What your subscription includes
              </div>
              <h2 className="mt-3 text-4xl font-bold">
                One operations dashboard, built for real estate
              </h2>
              <p className="mt-4 text-muted-foreground">
                Sales tracks leads and site visits, finance manages collections and overdue
                accounts, legal verifies documents and clears approvals — admin sees it all, with
                reports rolled up automatically. Connect your website, YouTube, Instagram and TikTok
                channels to feed leads straight into the pipeline.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Kanban pipeline from New lead to Sold",
                  "Installment schedules with automatic overdue flags",
                  "Document verification queue with audit trail",
                  "Multi-stage approval board across booking → possession",
                  "Marketing & lead-capture integrations (YouTube, Instagram, TikTok, analytics)",
                  "AI assistant for both your team and your buyers",
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

      <section id="stories" className="border-t border-border bg-card/40 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <div className="text-xs font-mono uppercase tracking-widest text-primary">
              Customer stories
            </div>
            <h2 className="mt-3 text-4xl font-bold">What teams on SAN Connect say</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {STORIES.map((s) => (
              <div
                key={s.name}
                className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card"
              >
                <Quote className="h-6 w-6 text-primary/40" />
                <p className="mt-3 flex-1 text-sm text-foreground/90">{s.quote}</p>
                <div className="mt-5 border-t border-border pt-4">
                  <div className="text-sm font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.role}</div>
                  <div className="mt-2 inline-flex items-center rounded-full bg-success/12 px-2.5 py-1 text-[11px] font-medium text-success">
                    {s.result}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Illustrative customer stories based on typical team workflows on SAN Connect.
          </p>
        </div>
      </section>

      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Trees className="mx-auto mb-4 h-8 w-8 text-primary" />
          <h2 className="text-4xl font-bold">Bring your team onto one platform.</h2>
          <p className="mt-4 text-muted-foreground">
            Sign in to explore the live demo — buyer portal, operations dashboard and AI assistant,
            all running on real inventory.
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
