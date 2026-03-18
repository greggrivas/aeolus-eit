"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { postChat, WorkOrder } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  work_order?: WorkOrder;
}

function WorkOrderCard({ wo }: { wo: WorkOrder }) {
  const urgencyColors = {
    HIGH: "border-red-500/40 bg-red-900/10",
    MEDIUM: "border-amber-500/40 bg-amber-900/10",
    LOW: "border-emerald-500/40 bg-emerald-900/10",
  };
  const urgencyText = {
    HIGH: "text-red-400",
    MEDIUM: "text-amber-400",
    LOW: "text-emerald-400",
  };

  return (
    <div className={`mt-2 rounded-lg border p-3 text-xs ${urgencyColors[wo.urgency]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono font-bold text-slate-200">{wo.work_order_id}</span>
        <span className={`font-bold uppercase tracking-wider ${urgencyText[wo.urgency]}`}>{wo.urgency}</span>
      </div>
      <p className="text-slate-300 font-medium mb-1">Asset #{wo.asset_id} — {wo.fault_description}</p>
      <p className="text-slate-500 mb-2">{wo.generated_at} · Est. {wo.estimated_inspection_hours}h inspection</p>

      {wo.top_contributing_sensors.length > 0 && (
        <div className="mb-2">
          <p className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">Top Sensors</p>
          {wo.top_contributing_sensors.slice(0, 3).map((s) => (
            <div key={s.sensor} className="flex items-center justify-between py-0.5">
              <span className="text-slate-400 truncate flex-1 mr-2">{s.description}</span>
              <span className="text-amber-400 font-mono shrink-0">z={s.z_score.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">Actions</p>
        {wo.recommended_actions.map((a, i) => (
          <div key={i} className="flex gap-1.5 py-0.5">
            <span className="text-slate-600 shrink-0">{i + 1}.</span>
            <span className="text-slate-400">{a}</span>
          </div>
        ))}
      </div>

      {wo.lead_time_hours != null && (
        <p className="mt-2 text-slate-600">{wo.notes}</p>
      )}
    </div>
  );
}

const SUGGESTIONS = [
  "Which turbine needs maintenance most urgently?",
  "Why is the detection rate low?",
  "Generate a work order for the highest priority asset",
  "What are the top contributing sensors for the worst event?",
];

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const pathname = usePathname();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function buildContext(): Record<string, unknown> {
    const ctx: Record<string, unknown> = {};
    const eventMatch = pathname.match(/\/events\/(\d+)/);
    if (eventMatch) ctx.event_id = Number(eventMatch[1]);
    return ctx;
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await postChat(msg, buildContext());
      if (res.error === "chat_not_configured") {
        setConfigured(false);
        setMessages((prev) => [...prev, { role: "assistant", content: "Chat is not configured — set OPENROUTER_API_KEY in your .env file." }]);
      } else {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: res.response ?? "No response.",
          work_order: res.work_order,
        }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Failed to reach the agent. Is the backend running?" }]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className={`flex-shrink-0 flex flex-col border-l border-border-dark bg-panel-dark transition-all duration-200 ${open ? "w-80" : "w-12"}`}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="h-14 flex items-center justify-center border-b border-border-dark text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
        title={open ? "Close chat" : "Open AI agent"}
      >
        <span className="material-symbols-outlined text-xl">{open ? "chevron_right" : "smart_toy"}</span>
      </button>

      {open && (
        <>
          {/* Header */}
          <div className="px-4 py-3 border-b border-border-dark">
            <p className="text-sm font-bold text-slate-100">AI Agent</p>
            <p className="text-[10px] text-slate-500">Context-aware · tool-calling · Wind Farm A</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 text-center py-2">Ask anything about the fleet</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left text-xs text-slate-400 hover:text-slate-200 bg-background-dark hover:bg-white/5 border border-border-dark rounded-lg px-3 py-2 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`max-w-[95%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary/20 text-slate-200 rounded-tr-sm"
                    : "bg-background-dark border border-border-dark text-slate-300 rounded-tl-sm"
                }`}>
                  {m.content}
                </div>
                {m.work_order && <WorkOrderCard wo={m.work_order} />}
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div className="bg-background-dark border border-border-dark rounded-xl rounded-tl-sm px-3 py-2">
                  <div className="flex gap-1 items-center">
                    <span className="size-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="size-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="size-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border-dark">
            {!configured ? (
              <p className="text-xs text-slate-600 text-center">Set OPENROUTER_API_KEY to enable chat</p>
            ) : (
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Ask about the fleet…"
                  rows={2}
                  className="flex-1 bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                  className="size-8 flex items-center justify-center bg-primary hover:bg-primary/90 disabled:opacity-40 rounded-lg transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-white text-base">send</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
