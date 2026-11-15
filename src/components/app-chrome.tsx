import { findHousehold, isDemo } from "@/lib/data";
import { BottomNav } from "./bottom-nav";
import { DemoBar } from "./demo-bar";

/*
 * Parts of the shell that depend on who's viewing. They live in the root layout (so they stay put
 * while pages change) and load inside <Suspense>, sharing the page's household load.
 */

/** Demo-mode bar at the top of every screen: who you're viewing the app as. */
export async function ViewerBar() {
  if (!(await isDemo())) return null;
  const household = await findHousehold();
  if (!household) return null;

  const people = household.members
    .filter((m) => m.kind === "line")
    .map((m) => ({
      id: m.id,
      label: m.role === "owner" ? `${household.ownerName} (owner)` : m.status === "invited" ? `${m.label} (invited)` : m.label,
    }));
  return <DemoBar people={people} current={household.viewer.memberId} />;
}

/** Tab bar for the current viewer: members don't get the owner-only tabs. */
export async function ViewerNav() {
  const household = await findHousehold();
  return <BottomNav isOwner={household?.viewer.isOwner ?? false} />;
}
