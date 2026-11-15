import { ComingSoon, PageHeader } from "@/components/page-header";

export default function HouseholdPage() {
  return (
    <>
      <PageHeader eyebrow="Household" title="Your people">
        Invite family members and manage who is in the pool.
      </PageHeader>
      <ComingSoon
        items={[
          "Invite a Dialog number to join the household",
          "Accept or decline an invite (member view)",
          "Remove a line or hand over ownership",
          "Members can request more data from the owner",
        ]}
      />
    </>
  );
}
