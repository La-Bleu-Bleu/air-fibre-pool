import { daysLeft, formatGb, formatLkr } from "../format";
import { monthlyPrice } from "../pricing";
import type { Catalogue, HouseholdSummary, MemberBalance } from "../types";
import { OUT_OF_SCOPE_REPLY } from "./prompt";
import { buildProposal } from "./tools";
import type { DiaEvent } from "./types";

/*
 * Demo-mode Dia: a scripted assistant, no AI and no API key. It recognises a handful of questions and
 * requests (the suggestion chips and close variations), answers from the demo household's real numbers,
 * and prepares the same confirm cards as the real assistant via buildProposal().
 */

const ON_TOPIC =
  /\b(data|gb|pool|plan|allocat\w*|household|home|router|wi-?fi|fib(re|er)|broadband|internet|request\w*|renew\w*|price|cost|lkr|line|member|invite\w*|left|usage|used|owner|approve|decline|dialog|kid|partner|amma|low|more|give|top ?up|upgrade|package|family|couple|solo|speed|5g)\b/i;

export function scriptedReply(message: string, h: HouseholdSummary, catalogue: Catalogue): DiaEvent[] {
  const text = message.trim().toLowerCase();
  const events: DiaEvent[] = [];
  const say = (s: string) => events.push({ type: "text", delta: s });
  const isOwner = h.viewer.isOwner;
  const me = h.members.find((m) => m.id === h.viewer.memberId)!;
  const unallocated = h.pool.sizeGb - h.members.reduce((s, m) => s + m.allocatedGb, 0);
  const gbAsked = Number(text.match(/(\d+)\s*(gb|gig)/)?.[1] ?? text.match(/\b(\d+)\b/)?.[1] ?? NaN);
  const left = (m: MemberBalance) => Math.max(0, Math.round((m.allocatedGb - m.usedGb) * 10) / 10);
  const named = findMember(text, h);

  const propose = (tool: string, input: unknown, intro: string) => {
    const outcome = buildProposal(tool, input, h, catalogue);
    if ("proposal" in outcome) {
      say(intro);
      events.push({ type: "proposal", proposal: outcome.proposal });
    } else say(`I couldn't set that up: ${outcome.error}`);
  };

  if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/.test(text)) {
    say(
      isOwner
        ? `Hi ${h.viewer.name}! I can tell you who's using what, check prices, and set up changes to allocations or your plan for you to confirm.`
        : `Hi ${h.viewer.name}! I can tell you how much data you have left and ask ${h.ownerName} for more on your behalf.`,
    );
    return events;
  }

  if (!ON_TOPIC.test(text)) {
    say(OUT_OF_SCOPE_REPLY);
    return events;
  }

  // Member: ask the owner for more
  if (!isOwner && /\b(ask|request|need|more)\b/.test(text)) {
    const gb = Number.isFinite(gbAsked) ? gbAsked : 10;
    propose("request_more_data", { gb, note: "" }, `Sure, I'll ask ${h.ownerName} for ${gb} GB. Tap Confirm to send it.`);
    return events;
  }

  // Owner: approve / decline a pending request
  if (isOwner && /\b(approve|decline|reject)\b/.test(text)) {
    const pending = h.requests.find((r) => r.status === "pending" && (!named || r.memberId === named.id));
    if (!pending) say("There aren't any pending data requests right now.");
    else {
      const approve = !/\b(decline|reject)\b/.test(text);
      propose("decide_request", { request_id: pending.id, approve }, approve ? "Here's the approval, ready to go:" : "Here's the decline, ready to go:");
    }
    return events;
  }

  // Owner: give someone more data
  if (isOwner && /\b(give|add|more|top ?up|increase)\b/.test(text) && !/\bline\b/.test(text)) {
    if (!named || named.kind === "home") {
      say("Who should get more data? For example: “Give Kid 1 10 GB more”.");
      return events;
    }
    const gb = Number.isFinite(gbAsked) ? gbAsked : 10;
    const changes = [{ member_id: named.id, gb: named.allocatedGb + gb }];
    let intro = `Here's ${gb} GB more for ${named.displayLabel}, from the unallocated data.`;
    if (unallocated < gb) {
      const home = h.members.find((m) => m.kind === "home")!;
      const fromHome = gb - Math.max(0, unallocated);
      changes.push({ member_id: home.id, gb: home.allocatedGb - fromHome });
      intro =
        unallocated > 0
          ? `There's only ${formatGb(unallocated)} unallocated, so I've also taken ${formatGb(fromHome)} from Home to give ${named.displayLabel} ${gb} GB more.`
          : `Nothing is unallocated, so I've taken ${formatGb(fromHome)} from Home to give ${named.displayLabel} ${gb} GB more.`;
    }
    propose("change_allocations", { changes }, intro);
    return events;
  }

  // Owner: change pool size
  if (isOwner && /\b(switch|upgrade|downgrade|change)\b/.test(text) && Number.isFinite(gbAsked)) {
    propose(
      "change_plan",
      { pool_gb: gbAsked, add_lines: [], remove_member_ids: [] },
      `Here's your plan on a ${gbAsked} GB pool. Have a look at the new price before confirming.`,
    );
    return events;
  }

  // Owner: what would N GB cost
  if (isOwner && /\b(cost|price|how much would)\b/.test(text) && Number.isFinite(gbAsked)) {
    const tier = catalogue.tiers.find((t) => t.poolGb === gbAsked);
    if (!tier) say(`Pools come in ${catalogue.tiers.map((t) => t.poolGb).join(", ")} GB.`);
    else {
      const lines = h.members.filter((m) => m.kind === "line").length;
      const price = monthlyPrice(catalogue, gbAsked, lines);
      const diff = price - h.pool.priceLkr;
      say(
        `With your ${lines} mobile lines, a ${gbAsked} GB pool would be ${formatLkr(price)}/month` +
          (diff === 0 ? ", the same as now." : `, ${formatLkr(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than now.`) +
          ` Say “switch to ${gbAsked} GB” and I'll set it up for you to confirm.`,
      );
    }
    return events;
  }

  // Who's running low
  if (/\b(low|running out|used up)\b/.test(text)) {
    const lowOnes = h.members.filter((m) => m.status === "active" && m.allocatedGb > 0 && m.usedGb / m.allocatedGb >= 0.8);
    if (!isOwner) {
      say(lowOnes.some((m) => m.id === me.id) ? `You're running low: ${formatGb(left(me))} left of ${formatGb(me.allocatedGb)}.` : `You're fine: ${formatGb(left(me))} left of ${formatGb(me.allocatedGb)}.`);
    } else if (lowOnes.length === 0) say("Nobody is running low right now.");
    else
      say(
        `Running low:\n${lowOnes.map((m) => `- ${m.displayLabel}: ${formatGb(left(m))} left of ${formatGb(m.allocatedGb)}`).join("\n")}\n\nWant me to give ${lowOnes[0].displayLabel} more?`,
      );
    return events;
  }

  // When does it renew
  if (/\b(renew|reset|end of|cycle)\b/.test(text)) {
    say(`Your pool renews on ${new Date(h.pool.cycleEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}, in ${daysLeft(h.pool.cycleEnd)} days.`);
    return events;
  }

  // How much is left
  if (/\b(left|remaining|how much)\b/.test(text)) {
    if (!isOwner || (named && named.id === me.id)) say(`You have ${formatGb(left(me))} left of your ${formatGb(me.allocatedGb)} this month.`);
    else if (named) say(`${named.displayLabel} has ${formatGb(left(named))} left of ${formatGb(named.allocatedGb)}.`);
    else {
      const used = h.members.reduce((s, m) => s + m.usedGb, 0);
      say(`The household has ${formatGb(Math.max(0, h.pool.sizeGb - used))} left of the ${formatGb(h.pool.sizeGb)} pool${unallocated > 0 ? `, and ${formatGb(unallocated)} isn't allocated to anyone yet` : ""}.`);
    }
    return events;
  }

  // Explain the plan
  if (/\b(plan|explain|package|pool)\b/.test(text)) {
    const lines = h.members.filter((m) => m.kind === "line").length;
    say(
      isOwner
        ? `You're on a ${formatGb(h.pool.sizeGb)} pool shared by your Air Fibre home and ${lines} mobile ${lines === 1 ? "line" : "lines"}, for ${formatLkr(h.pool.priceLkr)}/month. It renews in ${daysLeft(h.pool.cycleEnd)} days. You decide how much each connection gets in Allocate.`
        : `${h.ownerName} shares a ${formatGb(h.pool.sizeGb)} pool between the home and the family. You've been given ${formatGb(me.allocatedGb)} this month, and you can ask for more any time.`,
    );
    return events;
  }

  say(
    `This is a demo, so I only understand a few things. Try:\n${(isOwner
      ? ["Who's running low on data?", "Give Kid 1 10 GB more", "What would 500 GB cost?", "Approve the request"]
      : ["How much data do I have left?", "Ask for 10 GB more", "When does the pool renew?"]
    )
      .map((s) => `- ${s}`)
      .join("\n")}`,
  );
  return events;
}

/** The household member named in the message, matching longer names first ("kid 1" before "kid"). */
function findMember(text: string, h: HouseholdSummary): MemberBalance | undefined {
  if (/\b(me|my|myself|i)\b/.test(text)) return h.members.find((m) => m.id === h.viewer.memberId);
  return [...h.members]
    .sort((a, b) => b.label.length - a.label.length)
    .find((m) => text.includes(m.label.toLowerCase()) || text.includes(m.displayLabel.toLowerCase()));
}
