import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Search, Download, Wand2, Upload, BarChart3, Shield, Zap, Database,
  ArrowRight, CheckCircle2, Activity, Lock,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nexus Command — Find, Extract, Transform, Load, Analyze" },
      { name: "description", content: "The only data integration platform that auto-discovers your sources, applies policy-driven transformation, and ships executive analytics — in one." },
      { property: "og:title", content: "Nexus Command — Find, Extract, Transform, Load, Analyze" },
      { property: "og:description", content: "The only data integration platform that auto-discovers your sources, applies policy-driven transformation, and ships executive analytics — in one." },
    ],
  }),
  component: Landing,
});

const phases = [
  { icon: Search, name: "FIND", title: "Auto-discover sources", desc: "Authorized network scans surface every database, API, and SaaS in minutes — not weeks.", color: "chart-1" },
  { icon: Download, name: "EXTRACT", title: "Intelligent extraction", desc: "Dynamic connectors, incremental loads, real-time streaming, automatic schema discovery.", color: "chart-2" },
  { icon: Wand2, name: "TRANSFORM", title: "Policy-driven transforms", desc: "No-code builder with PCI, HIPAA, GDPR templates. PII masking and quality rules in one click.", color: "chart-3" },
  { icon: Upload, name: "LOAD", title: "Multi-destination delivery", desc: "Snowflake, BigQuery, Redshift, S3, reverse-ETL — smart upserts, SCD, streaming.", color: "chart-4" },
  { icon: BarChart3, name: "ANALYZE", title: "Executive intelligence", desc: "Auto-generated dashboards, anomaly detection, NL queries, forecasts — no BI tool needed.", color: "chart-5" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary-gradient text-primary-foreground">
              <Database className="h-4 w-4" />
            </div>
            <span>Nexus <span className="text-primary">Command</span></span>
          </Link>
          <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
            <a href="#platform" className="hover:text-foreground">Platform</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#compare" className="hover:text-foreground">Compare</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/auth"><Button size="sm" className="bg-primary text-primary-foreground hover:opacity-90">Get started</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute inset-0 bg-hero-gradient" />
        <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-32 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" /><span className="relative h-2 w-2 rounded-full bg-primary" /></span>
            FETLA v1 — Find · Extract · Transform · Load · Analyze
          </div>
          <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-tight tracking-tight md:text-7xl">
            Your data, <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">discovered</span>, transformed, and ready for the boardroom.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            The only platform that combines intelligent source discovery with policy-driven transformation and executive analytics. No Fivetran. No dbt. No Tableau. One unified workflow.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="bg-primary text-primary-foreground shadow-glow hover:opacity-90">
                Start discovering <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#platform"><Button size="lg" variant="outline">See the platform</Button></a>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-6 text-left md:grid-cols-4 md:gap-10">
            {[
              { k: "Setup time", v: "< 2 hours", sub: "vs 2–4 weeks" },
              { k: "Connectors", v: "40+", sub: "DB · API · SaaS · Warehouse" },
              { k: "Compliance", v: "GDPR · HIPAA · PCI", sub: "Built-in templates" },
              { k: "Time to insight", v: "Same day", sub: "Auto exec dashboards" },
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

      {/* Platform */}
      <section id="platform" className="border-t border-border py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <div className="text-xs font-mono uppercase tracking-widest text-primary">The FETLA Pipeline</div>
            <h2 className="mt-3 text-4xl font-bold md:text-5xl">Five phases. One platform.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">Everything between raw infrastructure and executive insight — without the seven tools traditionally required.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {phases.map((p, i) => (
              <div key={p.name} className="group relative overflow-hidden rounded-xl border border-border bg-card-gradient p-6 transition hover:border-primary/60 hover:shadow-glow">
                <div className="mb-4 flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><p.icon className="h-5 w-5" /></div>
                  <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                </div>
                <div className="font-mono text-xs tracking-widest text-primary">{p.name}</div>
                <h3 className="mt-2 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compare */}
      <section id="compare" className="border-t border-border bg-card/30 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-4xl font-bold">Why teams switch to Nexus Command</h2>
          <div className="mt-12 overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-3 border-b border-border bg-card/80 text-sm">
              <div className="p-4 font-semibold">Capability</div>
              <div className="p-4 text-muted-foreground">Fivetran + dbt + Tableau</div>
              <div className="p-4 font-semibold text-primary">Nexus Command</div>
            </div>
            {[
              ["Auto source discovery", "Manual setup", "Network scan in minutes"],
              ["Transformation policies", "Separate dbt project", "No-code + industry templates"],
              ["Executive analytics", "Separate BI tool", "Auto-generated dashboards"],
              ["Compliance (GDPR/HIPAA/PCI)", "Custom build", "1-click templates"],
              ["Vendor count", "3+ vendors", "1 unified platform"],
            ].map((row) => (
              <div key={row[0]} className="grid grid-cols-3 border-b border-border last:border-0 text-sm">
                <div className="p-4 font-medium">{row[0]}</div>
                <div className="p-4 text-muted-foreground">{row[1]}</div>
                <div className="p-4 flex items-center gap-2 text-foreground"><CheckCircle2 className="h-4 w-4 text-success" />{row[2]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-4xl font-bold">Pricing</h2>
          <p className="mt-3 text-center text-muted-foreground">Start free. Scale with usage.</p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { name: "Starter", price: "$299", sub: "/mo", features: ["2 data sources", "10 GB/mo", "Basic templates", "Email support"] },
              { name: "Professional", price: "$999", sub: "/mo", featured: true, features: ["10 data sources", "100 GB/mo", "Advanced templates", "Exec dashboards", "Priority support"] },
              { name: "Enterprise", price: "Custom", sub: "", features: ["Unlimited sources", "Unlimited volume", "SSO/SAML", "Dedicated CSM", "99.9% SLA"] },
            ].map((t) => (
              <div key={t.name} className={`rounded-2xl border p-8 ${t.featured ? "border-primary bg-card-gradient shadow-glow" : "border-border bg-card/50"}`}>
                <div className="text-sm font-semibold text-primary">{t.name}</div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold">{t.price}</span>
                  <span className="text-muted-foreground">{t.sub}</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />{f}</li>
                  ))}
                </ul>
                <Link to="/auth" className="mt-8 block">
                  <Button className="w-full" variant={t.featured ? "default" : "outline"}>Get started</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-4xl font-bold">Ship insight. Not infrastructure.</h2>
          <p className="mt-4 text-muted-foreground">Spin up your first pipeline in under an hour.</p>
          <Link to="/auth"><Button size="lg" className="mt-8 bg-primary text-primary-foreground shadow-glow">Start free <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          <div className="mt-12 flex flex-wrap justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> SOC 2 ready</span>
            <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> AES-256 at rest</span>
            <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> 99.9% uptime</span>
            <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> Real-time monitoring</span>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © 2026 Nexus Command — Built on the FETLA framework
      </footer>
    </div>
  );
}
