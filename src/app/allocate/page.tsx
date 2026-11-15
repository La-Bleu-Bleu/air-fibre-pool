import { PageHeader } from "@/components/page-header";
import { getHousehold } from "@/lib/data";
import { Allocator } from "./allocator";

export default async function AllocatePage() {
  const household = await getHousehold();

  return (
    <div className="pb-56">
      <PageHeader eyebrow="Step 2 of 2" title="Allocate">
        Decide how much of the {household.pool.sizeGb} GB pool each connection gets.
      </PageHeader>
      <Allocator poolGb={household.pool.sizeGb} members={household.members} />
    </div>
  );
}
