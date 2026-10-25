import { useRef, useState } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string };

const COPY: Record<"customer" | "staff", { greeting: string; placeholder: string }> = {
  customer: {
    greeting: "Hi! Ask me about your booking, payment schedule, documents or financing options.",
    placeholder: "Ask about payments, documents, loans…",
  },
  staff: {
    greeting: "Hi! Ask me about leads, inventory, collections, approvals or your open tasks.",
    placeholder: "Ask about leads, inventory, collections…",
  },
};

export function ChatWidget({ audience = "customer" }: { audience?: "customer" | "staff" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const copy = COPY[audience];

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-agent", {
        body: { messages: next },
      });
      if (error) throw error;
      setMessages([
        ...next,
        { role: "assistant", content: data?.reply || "Sorry, I couldn't find an answer to that." },
      ]);
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: "I'm having trouble connecting right now — please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
      );
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105"
        aria-label="Open AI assistant"
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold">SAN Connect Assistant</span>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            <div className="rounded-xl bg-muted px-3 py-2 text-sm text-foreground/90">
              {copy.greeting}
            </div>
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm",
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted text-foreground/90",
                )}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="w-fit rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                Thinking…
              </div>
            )}
          </div>

          <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={copy.placeholder}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
