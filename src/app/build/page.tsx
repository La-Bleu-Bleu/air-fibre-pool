import { ComingSoon, PageHeader } from "@/components/page-header";

export default function BuildPoolPage() {
  return (
    <>
      <PageHeader eyebrow="Step 1" title="Build your pool">
        Pick one monthly data pool for your whole home.
      </PageHeader>
      <ComingSoon
        items={[
          "Slider with stops at 10, 20, 50, 100, 200 and 500 GB",
          "Live price that updates as you slide",
          "Add a line: bring another Dialog mobile number into the pool",
          "Preset packages (Solo, Couple, Family) as a starting point",
        ]}
      />
    </>
  );
}
