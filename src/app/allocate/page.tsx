import { PageHeader } from "@/components/page-header";
import { getHouseholdAsOwner } from "@/lib/data";
import { Allocator } from "./allocator";

export default async function AllocatePage({ searchParams }: PageProps<"/allocate">) {
  const household = await getHouseholdAsOwner();
  const setup = (await searchParams).setup === "1"; // arrived from first-time setup

  return (
    <div className="pb-56">
      <PageHeader eyebrow={setup ? "Get started · 2 of 2" : "Allocate"} title={setup ? "Share it out" : "Who gets what"}>
        Decide how much of the {household.pool.sizeGb} GB pool each connection gets.
      </PageHeader>
      <Allocator poolGb={household.pool.sizeGb} members={household.members} setup={setup} />
    </div>
  );
}
