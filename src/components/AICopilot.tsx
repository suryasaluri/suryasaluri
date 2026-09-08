import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, X, ArrowUp, Plus, Mic } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { NexusChart, CsvBlock, type ChartSpec } from "./NexusChart";

const SUGGESTIONS = [
  "Find all customer data sources",
  "Forecast FY2026 revenue",
  "Who has access to Finance data?",
  "Why did last night's pipeline fail?",
];

const transport = new DefaultChatTransport({ api: "/api/chat" });

function extractText(m: UIMessage) {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

/** Pull out and strip the followups block; return clean text + suggestions. */
function splitFollowups(text: string): { body: string; followups: string[] } {
  const m = /```followups\n([\s\S]*?)```/.exec(text);
  if (!m) return { body: text, followups: [] };
  const followups = m[1]
    .split("\n")
    .map((s) => s.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 4);
  return { body: text.replace(m[0], "").trim(), followups };
}

function renderRichMarkdown(text: string) {
  if (!text) return null;
  const regex = /```(chart|csv)\n([\s\S]*?)```/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text))) {
    if (m.index > last) out.push(<MarkdownChunk key={`md-${i}`} text={text.slice(last, m.index)} />);
    if (m[1] === "chart") {
      try {
        const spec = JSON.parse(m[2]) as ChartSpec;
        out.push(<NexusChart key={`c-${i}`} spec={spec} />);
      } catch {
        out.push(
          <div key={`e-${i}`} className="my-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            Invalid chart spec.
          </div>
        );
      }
    } else {
      out.push(<CsvBlock key={`csv-${i}`} csv={m[2]} />);
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(<MarkdownChunk key={`md-tail`} text={text.slice(last)} />);
  return out;
}

function MarkdownChunk({ text }: { text: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none [&_code]:rounded [&_code]:bg-muted/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-primary [&_h1]:mt-3 [&_h1]:font-display [&_h1]:text-base [&_h2]:mt-3 [&_h2]:font-mono [&_h2]:text-[10px] [&_h2]:uppercase [&_h2]:tracking-[0.18em] [&_h2]:text-primary [&_h3]:mt-2 [&_h3]:text-sm [&_li]:my-0.5 [&_p]:my-1.5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-background/60 [&_pre]:p-3 [&_pre]:text-xs [&_strong]:text-foreground [&_table]:my-2 [&_table]:w-full [&_table]:text-xs [&_th]:border-b [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border-b [&_td]:border-border/30 [&_td]:px-2 [&_td]:py-1">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}

/** Siri-like animated orb. */
function NexusOrb({ size = 64, active = false }: { size?: number; active?: boolean }) {
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#22d3ee,#0ea5e9,#14b8a6,#22d3ee)] blur-[8px] animate-spin opacity-80"
        style={{ animationDuration: active ? "3s" : "10s" }}
      />
      <div className="absolute inset-[14%] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.9),rgba(34,211,238,0.4)_40%,rgba(15,23,42,0.9)_75%)]" />
      <div className={`absolute inset-[28%] rounded-full bg-white/30 blur-sm ${active ? "animate-pulse" : ""}`} />
    </div>
  );
}

export function AICopilot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [convId, setConvId] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: `nexus-${convId}`,
    transport,
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const submit = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    await sendMessage({ text: t });
    inputRef.current?.focus();
  };

  const reset = () => {
    setMessages([]);
    setConvId((c) => c + 1);
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }, []);

  // last assistant message followups (for chips below stream)
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastFollowups = lastAssistant && !busy ? splitFollowups(extractText(lastAssistant)).followups : [];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="group fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-background/30 backdrop-blur-md ring-1 ring-cyan-300/40 shadow-[0_10px_40px_-10px_rgba(34,211,238,0.6)] transition hover:scale-105"
          aria-label="Open NEXUS AI"
        >
          <NexusOrb size={44} />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l border-primary/20 bg-[radial-gradient(ellipse_at_top,_var(--card)_0%,_var(--background)_70%)] p-0 sm:max-w-xl"
      >
        {/* Minimal header */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <NexusOrb size={28} active={busy} />
            <div>
              <div className="font-display text-sm font-semibold tracking-tight">NEXUS</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                {busy ? "Listening" : "Ready"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={reset} title="New conversation">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <NexusOrb size={120} active />
              <h2 className="mt-8 bg-gradient-to-r from-cyan-200 via-primary to-teal-300 bg-clip-text font-display text-2xl font-semibold text-transparent">
                {greeting}.
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">What can I help you find?</p>
              <div className="mt-8 flex w-full max-w-md flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="rounded-full border border-border/60 bg-card/40 px-3.5 py-1.5 text-xs text-foreground/80 backdrop-blur transition hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((m) => {
                const raw = extractText(m);
                if (m.role === "user") {
                  return (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm leading-relaxed text-primary-foreground shadow-sm">
                        {raw}
                      </div>
                    </div>
                  );
                }
                const { body } = splitFollowups(raw);
                return (
                  <div key={m.id} className="flex gap-3">
                    <div className="mt-1 shrink-0">
                      <NexusOrb size={22} active={busy && m.id === messages[messages.length - 1]?.id} />
                    </div>
                    <div className="min-w-0 flex-1 text-[15px] leading-relaxed text-foreground/95">
                      {renderRichMarkdown(body) ?? (busy && <span className="text-muted-foreground italic">…</span>)}
                    </div>
                  </div>
                );
              })}
              {status === "submitted" && (
                <div className="flex items-center gap-3 pl-1">
                  <NexusOrb size={22} active />
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              {/* Follow-up chips after assistant message */}
              {lastFollowups.length > 0 && (
                <div className="space-y-2 pl-9">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Suggested</div>
                  <div className="flex flex-wrap gap-2">
                    {lastFollowups.map((f) => (
                      <button
                        key={f}
                        onClick={() => submit(f)}
                        className="group inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs text-foreground/90 transition hover:border-primary/60 hover:bg-primary/10"
                      >
                        {f}
                        <ArrowUp className="h-3 w-3 rotate-45 text-primary/70 transition group-hover:text-primary" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  {error.message}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer — pill style */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="border-t border-border/40 bg-background/60 p-3 backdrop-blur-xl"
        >
          <div className="flex items-end gap-2 rounded-full border border-border/80 bg-card/60 px-2 py-1.5 shadow-inner transition focus-within:border-primary/60 focus-within:shadow-[0_0_0_3px_rgba(34,211,238,0.12)]">
            <Mic className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(input);
                }
              }}
              placeholder="Ask NEXUS anything…"
              rows={1}
              className="min-h-[32px] max-h-32 resize-none border-0 bg-transparent px-1 py-1.5 text-sm focus-visible:ring-0"
              disabled={busy}
            />
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-cyan-400 to-teal-600 text-primary-foreground shadow-md shadow-primary/20 hover:opacity-90"
              disabled={busy || !input.trim()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
