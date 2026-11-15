import { OwnerOnly } from "@/components/owner-only";
import { PageHeader } from "@/components/page-header";
import { getCatalogue, getHousehold } from "@/lib/data";
import { PoolBuilder } from "./pool-builder";

export default async function BuildPoolPage() {
  const [household, catalogue] = await Promise.all([getHousehold(), getCatalogue()]);

  if (!household.viewer.isOwner) {
    return (
      <>
        <PageHeader eyebrow="Pool" title="Household plan" />
        <OwnerOnly ownerName={household.ownerName} what="change the pool or add lines" />
      </>
    );
  }

  const lines = household.members
    .filter((m) => m.kind === "line")
    .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0))
    .map(({ id, label, msisdn, role, status }) => ({ id, label, msisdn: msisdn ?? "", isOwner: role === "owner", invited: status === "invited" }));

  return (
    <div className="pb-56">
      <PageHeader eyebrow="Step 1 of 2" title="Build your pool">
        One monthly data pool for your home and everyone on it.
      </PageHeader>
      <PoolBuilder catalogue={catalogue} initialPoolGb={household.pool.sizeGb} initialLines={lines} />
    </div>
  );
}
