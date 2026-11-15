import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { findHousehold, getCatalogue, isDemo } from "@/lib/data";
import { accountSnapshot, DIA_SYSTEM_PROMPT } from "@/lib/dia/prompt";
import { scriptedReply } from "@/lib/dia/scripted";
import { buildProposal, toolsFor } from "@/lib/dia/tools";
import type { DiaEvent } from "@/lib/dia/types";

/*
 * Ask Dia: a streaming chat with Claude, scoped to the signed-in person's household.
 * In demo mode it's scripted instead (no AI, no API key needed).
 *
 * The client sends the conversation as plain text turns. Each request appends the current account
 * snapshot as a system message after the latest user turn, so Dia always sees live data. Tools never
 * change anything; they return proposals the user confirms in the UI (see lib/dia/tools.ts).
 */

const MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 4;
const MAX_TURNS = 30; // keep the conversation (and cost) bounded
const MAX_MESSAGE_CHARS = 1000;

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1),
});

export async function POST(request: Request) {
  const household = await findHousehold();
  if (!household) return Response.json({ error: "Sign in and join a household to chat with Dia." }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request." }, { status: 400 });
  const turns = parsed.data.messages.slice(-MAX_TURNS);
  // The API needs the conversation to start with a user turn.
  while (turns.length && turns[0].role !== "user") turns.shift();
  const last = turns.at(-1);
  if (!last || last.role !== "user") return Response.json({ error: "Bad request." }, { status: 400 });
  if (last.content.length > MAX_MESSAGE_CHARS)
    return Response.json({ error: `Please keep messages under ${MAX_MESSAGE_CHARS} characters.` }, { status: 400 });

  const catalogue = await getCatalogue();

  // Demo mode: scripted Dia, no AI and no API key (lib/dia/scripted.ts).
  if (await isDemo()) return ndjson(typeOut(scriptedReply(last.content, household, catalogue)));

  if (!process.env.ANTHROPIC_API_KEY)
    return Response.json({ error: "Dia isn't switched on yet." }, { status: 503 });

  const tools = toolsFor(household.viewer.isOwner);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...turns.map((t) => ({ role: t.role, content: t.content })),
    { role: "system", content: accountSnapshot(household, catalogue) },
  ];

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: DiaEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const stream = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 8000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default", // on a policy decline, the API retries on a fallback model
            output_config: { effort: "low" }, // chat: quick, short answers
            system: [{ type: "text", text: DIA_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
            tools,
            messages,
          });
          stream.on("text", (delta) => send({ type: "text", delta }));
          const message = await stream.finalMessage();

          if (message.stop_reason === "refusal") {
            send({ type: "text", delta: "\n\nSorry, I can't help with that one." });
            break;
          }
          const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
          if (toolUses.length === 0) break;
          if (message.stop_reason === "max_tokens") {
            send({ type: "error", message: "Dia's reply was cut off. Try asking again." });
            break;
          }

          // Validate each call against the real household. Valid ones become confirm cards.
          const outcomes = toolUses.map((t) => ({ tool: t, outcome: buildProposal(t.name, t.input, household, catalogue) }));
          for (const { outcome } of outcomes) if ("proposal" in outcome) send({ type: "proposal", proposal: outcome.proposal });

          // All good: the turn ends with the cards. If any call was invalid, let Dia see why and respond.
          if (outcomes.every(({ outcome }) => "proposal" in outcome)) break;
          messages.push({ role: "assistant", content: message.content });
          messages.push({
            role: "user",
            content: outcomes.map(({ tool, outcome }) =>
              "proposal" in outcome
                ? { type: "tool_result" as const, tool_use_id: tool.id, content: "Shown to the user as a confirmation card." }
                : { type: "tool_result" as const, tool_use_id: tool.id, content: outcome.error, is_error: true },
            ),
          });
          send({ type: "text", delta: "\n\n" });
        }
      } catch (error) {
        send({ type: "error", message: describeError(error) });
        console.error("Dia error", error);
      } finally {
        send({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Stream pre-written events, a few words at a time, so the scripted demo reads like a live reply. */
async function* typeOut(events: DiaEvent[]): AsyncGenerator<DiaEvent> {
  const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await pause(350); // "thinking"
  for (const event of events) {
    if (event.type !== "text") {
      yield event;
      continue;
    }
    for (const chunk of event.delta.match(/\S+\s*|\s+/g) ?? []) {
      yield { type: "text", delta: chunk };
      await pause(25);
    }
  }
}

function ndjson(events: AsyncIterable<DiaEvent>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const event of events) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      controller.enqueue(encoder.encode(JSON.stringify({ type: "done" } satisfies DiaEvent) + "\n"));
      controller.close();
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "Dia isn't set up correctly (invalid API key).";
  if (error instanceof Anthropic.RateLimitError) return "Dia is busy right now. Please try again in a moment.";
  if (error instanceof Anthropic.APIConnectionError) return "Couldn't reach Dia. Check your connection and try again.";
  if (error instanceof Anthropic.APIError) return "Dia ran into a problem. Please try again.";
  return "Something went wrong. Please try again.";
}
