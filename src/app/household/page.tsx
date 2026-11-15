import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { getHousehold } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { isDemoMode } from "@/lib/mode";
import { formatMsisdn } from "@/lib/pricing";
import { MemberView } from "./member-view";
import { OwnerView, type RequestRow } from "./owner-view";
import { ViewAs } from "./view-as";

export default async function HouseholdPage() {
  const household = await getHousehold();
  const { members, viewer, pool } = household;
  const unallocatedGb = pool.sizeGb - members.reduce((s, m) => s + m.allocatedGb, 0);

  // Resolve names, colours and relative times on the server so client components stay simple.
  const byId = new Map(members.map((m) => [m.id, m]));
  const requests: RequestRow[] = household.requests.flatMap((r) => {
    const m = byId.get(r.memberId);
    return m ? [{ ...r, memberLabel: m.displayLabel, memberColor: m.color, when: timeAgo(r.createdAt) }] : [];
  });

  const people = members
    .filter((m) => m.kind === "line")
    .map((m) => ({ id: m.id, label: m.role === "owner" ? `${household.ownerName} (owner)` : m.label }));

  const lines = members.filter((m) => m.kind === "line").length;
  const me = byId.get(viewer.memberId)!;

  return (
    <div className="pb-8">
      <PageHeader eyebrow="Household" title={household.name}>
        {members.length} connections · home + {lines} {lines === 1 ? "line" : "lines"}
      </PageHeader>
      {isDemoMode && <ViewAs people={people} current={viewer.memberId} />}
      {viewer.isOwner ? (
        <OwnerView members={members} requests={requests} unallocatedGb={unallocatedGb} />
      ) : (
        <MemberView
          me={me}
          members={members}
          requests={requests.filter((r) => r.memberId === viewer.memberId)}
          ownerName={household.ownerName}
          householdName={household.name}
        />
      )}

      {!isDemoMode && (
        <section className="mx-4 mt-8 flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
          <div className="text-sm">
            <p className="font-semibold">Signed in</p>
            <p className="text-muted">{me.msisdn ? formatMsisdn(me.msisdn) : viewer.name}</p>
          </div>
          <form action={signOut}>
            <button className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-danger hover:text-danger">
              <LogOut size={15} /> Sign out
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
