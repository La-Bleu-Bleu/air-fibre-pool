import { ComingSoon, PageHeader } from "@/components/page-header";

export default function AllocatePage() {
  return (
    <>
      <PageHeader eyebrow="Step 2" title="Allocate">
        Decide how much of the pool each connection gets.
      </PageHeader>
      <ComingSoon
        items={[
          "A slider per connection: Home, Me, Partner, Kids",
          "Running total that always adds up to the pool",
          "Stacked bar showing everyone's share",
          "Only the owner can change allocations",
        ]}
      />
    </>
  );
}
