/** Shared between the Dia API route and the chat UI. */

/** A change Dia has prepared. The app only applies it when the user taps Confirm. */
export type DiaProposal = { id: string; title: string; lines: string[] } & (
  | { kind: "allocations"; allocations: Record<string, number> }
  | { kind: "plan"; poolGb: number; planLines: { id?: string; label: string; msisdn: string }[] }
  | { kind: "request_decision"; requestId: string; approve: boolean }
  | { kind: "data_request"; gb: number; note: string }
);

/** One chat turn as the client stores it: plain text only. */
export interface DiaTurn {
  role: "user" | "assistant";
  content: string;
}

/** Newline-delimited JSON events streamed from /api/dia. */
export type DiaEvent =
  | { type: "text"; delta: string }
  | { type: "proposal"; proposal: DiaProposal }
  | { type: "error"; message: string }
  | { type: "done" };
