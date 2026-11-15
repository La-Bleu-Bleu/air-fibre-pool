"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, Check, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { requestData, respondToRequest, saveAllocations, savePlan } from "@/app/actions";
import type { DiaEvent, DiaProposal, DiaTurn } from "@/lib/dia/types";

type ProposalState = "open" | "applying" | "done" | "cancelled";

interface ChatItem {
  id: string;
  role: "user" | "assistant" | "note"; // note = app-reported outcome of a confirm card
  text: string;
  proposals?: { proposal: DiaProposal; state: ProposalState; error?: string }[];
  error?: string;
}

const newId = () => crypto.randomUUID();

export function DiaChat({
  storageKey,
  viewerName,
  suggestions,
  configured,
  demo,
}: {
  storageKey: string;
  viewerName: string;
  suggestions: string[];
  configured: boolean;
  demo: boolean;
}) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [restored, setRestored] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Restore this tab's conversation after mounting (storage isn't available during server rendering).
  useEffect(() => {
    setItems(load(storageKey)); // eslint-disable-line react-hooks/set-state-in-effect -- one-time restore from storage
    setRestored(true);
  }, [storageKey]);

  // Keep the conversation for this browser tab (it's cleared when the tab closes).
  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(items.slice(-60)));
    } catch {
      // storage unavailable (private mode etc.): the chat still works, it just won't survive a reload
    }
  }, [items, storageKey, restored]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items]);

  function update(id: string, fn: (item: ChatItem) => ChatItem) {
    setItems((prev) => prev.map((i) => (i.id === id ? fn(i) : i)));
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;
    setInput("");

    const user: ChatItem = { id: newId(), role: "user", text: message };
    const reply: ChatItem = { id: newId(), role: "assistant", text: "" };
    const history = [...items, user];
    setItems([...history, reply]);
    setStreaming(true);

    try {
      const res = await fetch("/api/dia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: toTurns(history) }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        update(reply.id, (i) => ({ ...i, error: body?.error ?? "Dia couldn't answer. Please try again." }));
        return;
      }

      // Newline-delimited JSON events
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as DiaEvent;
          if (event.type === "text") update(reply.id, (i) => ({ ...i, text: i.text + event.delta }));
          else if (event.type === "proposal")
            update(reply.id, (i) => ({ ...i, proposals: [...(i.proposals ?? []), { proposal: event.proposal, state: "open" }] }));
          else if (event.type === "error") update(reply.id, (i) => ({ ...i, error: event.message }));
        }
      }
    } catch {
      update(reply.id, (i) => ({ ...i, error: "Couldn't reach Dia. Check your connection and try again." }));
    } finally {
      setStreaming(false);
    }
  }

  /** Record what happened to a card, so Dia knows on the next message. */
  function note(text: string) {
    setItems((prev) => [...prev, { id: newId(), role: "note", text }]);
  }

  function setProposal(itemId: string, proposalId: string, patch: { state: ProposalState; error?: string }) {
    update(itemId, (i) => ({
      ...i,
      proposals: i.proposals?.map((p) => (p.proposal.id === proposalId ? { ...p, ...patch } : p)),
    }));
  }

  if (!configured)
    return (
      <Shell>
        <Intro viewerName={viewerName} />
        <p className="mx-4 rounded-2xl bg-surface p-4 text-sm text-muted">
          Dia isn&apos;t available yet. In the meantime, try it in the demo (sign out, then Explore the demo).
        </p>
      </Shell>
    );

  return (
    <Shell>
      {items.length === 0 ? (
        <>
          <Intro viewerName={viewerName} />
          {demo && (
            <p className="mx-5 -mt-2 mb-4 text-xs text-muted">Demo: Dia follows a script here and understands a few common requests.</p>
          )}
          <div className="mx-4 flex flex-wrap gap-2">
            {suggestions.slice(0, 4).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-medium transition hover:border-brand-500"
              >
                {s}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {demo && (
            // Demo only: start over to try the other suggestions (like "Reset demo data" on Home)
            <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Demo chat</span>
              <button
                type="button"
                onClick={() => setItems([])}
                disabled={streaming}
                className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-semibold transition hover:border-brand-500 disabled:opacity-50"
              >
                <RotateCcw size={13} /> Reset chat
              </button>
            </div>
          )}
        <ol className="space-y-3 px-4 pt-2" aria-live="polite">
          {items.map((item) =>
            item.role === "note" ? (
              <li key={item.id} className="flex justify-center">
                <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-muted">{noteLabel(item.text)}</span>
              </li>
            ) : item.role === "user" ? (
              <li key={item.id} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-brand-600 px-4 py-2.5 text-[15px] text-white">
                  {item.text}
                </p>
              </li>
            ) : (
              <li key={item.id} className="flex gap-2.5">
                <DiaAvatar />
                <div className="min-w-0 max-w-[85%] space-y-2">
                  {(item.text || (!item.error && !item.proposals?.length)) && (
                    <p className="whitespace-pre-wrap rounded-3xl rounded-tl-lg border border-border bg-surface px-4 py-2.5 text-[15px]">
                      {item.text.trim() || <TypingDots />}
                    </p>
                  )}
                  {item.proposals?.map(({ proposal, state, error }) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      state={state}
                      error={error}
                      onCancel={() => {
                        setProposal(item.id, proposal.id, { state: "cancelled" });
                        note(`[Cancelled] ${proposal.title}`);
                      }}
                      onConfirm={async () => {
                        setProposal(item.id, proposal.id, { state: "applying" });
                        const result = await apply(proposal);
                        if (result?.error) {
                          setProposal(item.id, proposal.id, { state: "open", error: result.error });
                        } else {
                          setProposal(item.id, proposal.id, { state: "done" });
                          note(`[Confirmed] ${proposal.title}: ${proposal.lines.join("; ")}`);
                        }
                      }}
                    />
                  ))}
                  {item.error && <p className="rounded-2xl bg-danger/10 px-4 py-2.5 text-sm text-danger">{item.error}</p>}
                </div>
              </li>
            ),
          )}
          {/* Follow-ups: the suggestions not asked yet, once Dia has answered */}
          {!streaming && items.at(-1)?.role !== "user" && (
            <li className="pt-1">
              {followUps(items, suggestions).length > 0 ? (
                <div className="flex flex-wrap gap-2 pl-10">
                  {followUps(items, suggestions).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-medium transition hover:border-brand-500"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                demo && <p className="pl-10 text-xs text-muted">You&apos;ve tried every suggestion. Tap Reset chat to start over.</p>
              )}
            </li>
          )}
          <div ref={bottomRef} />
        </ol>
        </>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),12px)+84px)] z-10 mx-auto w-full max-w-[440px] px-4"
      >
        <div className="flex items-end gap-2 rounded-[1.75rem] border border-border bg-surface/95 p-2 shadow-xl shadow-brand-900/10 backdrop-blur-xl">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 1000))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask Dia about your data…"
            aria-label="Message Dia"
            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-muted/70"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            aria-label="Send"
            className="bg-brand-gradient grid size-10 shrink-0 place-items-center rounded-full text-white transition disabled:opacity-40"
          >
            {streaming ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
          </button>
        </div>
      </form>
    </Shell>
  );
}

/** Run a confirmed proposal through the same server actions the normal screens use. */
async function apply(p: DiaProposal) {
  switch (p.kind) {
    case "allocations":
      return saveAllocations(p.allocations, "stay");
    case "plan":
      return savePlan(p.poolGb, p.planLines, "stay");
    case "request_decision":
      return respondToRequest(p.requestId, p.approve);
    case "data_request":
      return requestData(p.gb, p.note);
  }
}

/** Up to four suggestions the person hasn't asked yet, in their listed order. */
function followUps(items: ChatItem[], suggestions: string[]) {
  const asked = new Set(items.filter((i) => i.role === "user").map((i) => i.text.trim().toLowerCase()));
  return suggestions.filter((s) => !asked.has(s.toLowerCase())).slice(0, 4);
}

/** What goes back to the API: plain text turns, with card outcomes as short user notes. */
function toTurns(items: ChatItem[]): DiaTurn[] {
  return items
    .filter((i) => i.text.trim() || i.proposals?.length)
    .map((i) => ({
      role: i.role === "assistant" ? "assistant" : "user",
      content:
        i.role === "assistant"
          ? [i.text.trim(), ...(i.proposals ?? []).map((p) => `(Prepared for confirmation: ${p.proposal.title})`)]
              .filter(Boolean)
              .join("\n")
          : i.text,
    }));
}

function load(key: string): ChatItem[] {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ChatItem[]) : [];
  } catch {
    return [];
  }
}

const noteLabel = (text: string) =>
  text.startsWith("[Confirmed]") ? `✓ Done: ${text.slice(12).split(":")[0]}` : `Cancelled: ${text.slice(12)}`;

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[calc(100dvh-7rem)] flex-col pb-44">{children}</div>; // room for the message box above the tab bar
}

function Intro({ viewerName }: { viewerName: string }) {
  return (
    <header className="px-5 pt-[max(env(safe-area-inset-top),24px)] pb-5">
      <span className="bg-brand-gradient grid size-14 place-items-center rounded-2xl text-white shadow-lg shadow-brand-600/30">
        <Sparkles size={26} />
      </span>
      <h1 className="mt-4 text-[28px] font-extrabold leading-tight tracking-tight">Hi {viewerName}, I&apos;m Dia</h1>
      <p className="mt-1 text-[15px] text-muted">
        Ask me about your data, your plan or your household. I can also set things up for you to confirm.
      </p>
    </header>
  );
}

function DiaAvatar() {
  return (
    <span className="bg-brand-gradient mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl text-white">
      <Sparkles size={15} />
    </span>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label="Dia is typing">
      {[0, 150, 300].map((d) => (
        <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

function ProposalCard({
  proposal,
  state,
  error,
  onConfirm,
  onCancel,
}: {
  proposal: DiaProposal;
  state: ProposalState;
  error?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const busy = pending || state === "applying";

  return (
    <div
      className={`rounded-3xl border p-4 ${
        state === "done" ? "border-success/40 bg-success/5" : state === "cancelled" ? "border-border bg-surface opacity-60" : "border-brand-500/40 bg-surface"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink">
        {state === "done" ? "Done" : state === "cancelled" ? "Cancelled" : "Please confirm"}
      </p>
      <p className="mt-1 font-bold">{proposal.title}</p>
      {proposal.lines.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {proposal.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
      {(state === "open" || state === "applying") && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-semibold disabled:opacity-50"
          >
            <X size={15} /> Cancel
          </button>
          <button
            type="button"
            onClick={() => startTransition(onConfirm)}
            disabled={busy}
            className="bg-brand-gradient flex h-10 flex-[2] items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Confirm
          </button>
        </div>
      )}
    </div>
  );
}
