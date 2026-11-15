import { PageHeader } from "@/components/page-header";
import { getHousehold } from "@/lib/data";
import { timeAgo } from "@/lib/format";
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

  return (
    <div className="pb-8">
      <PageHeader eyebrow="Household" title={household.name}>
        {members.length} connections · home + {lines} {lines === 1 ? "line" : "lines"}
      </PageHeader>
      <ViewAs people={people} current={viewer.memberId} />
      {viewer.isOwner ? (
        <OwnerView members={members} requests={requests} unallocatedGb={unallocatedGb} />
      ) : (
        <MemberView
          me={byId.get(viewer.memberId)!}
          members={members}
          requests={requests.filter((r) => r.memberId === viewer.memberId)}
          ownerName={household.ownerName}
          householdName={household.name}
        />
      )}
    </div>
  );
}
