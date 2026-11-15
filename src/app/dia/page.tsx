import { getHousehold, isDemo } from "@/lib/data";
import { DiaChat } from "./dia-chat";

/** Ask Dia: chat with Dialog's digital assistant about this household. */
export default async function DiaPage() {
  const household = await getHousehold();
  const demo = await isDemo();
  const { viewer } = household;

  const firstLowMember = household.members.find(
    (m) => m.kind === "line" && m.role !== "owner" && m.allocatedGb > 0 && m.usedGb / m.allocatedGb >= 0.6,
  );
  const someone = firstLowMember ?? household.members.find((m) => m.kind === "line" && m.role !== "owner");

  const suggestions = viewer.isOwner
    ? [
        "Who's running low on data?",
        someone ? `Give ${someone.displayLabel} 10 GB more` : "How much data is unallocated?",
        "What would 500 GB cost?",
        "Approve the request",
      ]
    : ["How much data do I have left?", "Ask for 10 GB more", "When does the pool renew?"];

  return (
    <DiaChat
      key={viewer.memberId} // a fresh conversation per person (matters when switching in the demo)
      storageKey={`dia:${household.id}:${viewer.memberId}`}
      viewerName={viewer.name}
      suggestions={suggestions}
      configured={demo || Boolean(process.env.ANTHROPIC_API_KEY)}
      demo={demo}
    />
  );
}
