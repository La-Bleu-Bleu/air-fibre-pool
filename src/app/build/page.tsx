import { PageHeader } from "@/components/page-header";
import { getCatalogue, getHouseholdAsOwner } from "@/lib/data";
import { PlanView } from "./plan-view";
import { PoolBuilder } from "./pool-builder";

/** Pool tab: your current plan (and changing it), or choosing a pool during first-time setup. */
export default async function PoolPage({ searchParams }: PageProps<"/build">) {
  const [household, catalogue] = await Promise.all([getHouseholdAsOwner(), getCatalogue()]);
  const params = await searchParams;
  const setup = params.setup === "1";

  const lines = household.members
    .filter((m) => m.kind === "line")
    .map(({ id, label, msisdn, role, status }) => ({
      id,
      label,
      msisdn: msisdn ?? "",
      isOwner: role === "owner",
      invited: status === "invited",
    }));

  if (setup) {
    return (
      <div className="pb-56">
        <PageHeader eyebrow="Get started · 1 of 2" title="Choose your pool">
          One monthly data pool for your home and everyone on it. You can change it any time.
        </PageHeader>
        <PoolBuilder mode="setup" catalogue={catalogue} initialPoolGb={household.pool.sizeGb} initialLines={lines} />
      </div>
    );
  }

  const unallocatedGb = household.pool.sizeGb - household.members.reduce((s, m) => s + m.allocatedGb, 0);

  return (
    <PlanView
      catalogue={catalogue}
      poolGb={household.pool.sizeGb}
      priceLkr={household.pool.priceLkr}
      cycleEnd={household.pool.cycleEnd}
      unallocatedGb={unallocatedGb}
      lines={lines}
      startEditing={params.edit === "1"}
    />
  );
}
