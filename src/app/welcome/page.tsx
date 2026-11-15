import { redirect } from "next/navigation";
import { connection } from "next/server";
import { signOut } from "@/app/actions";
import { InviteCard } from "@/components/invite-card";
import { getRepo } from "@/lib/data";
import { CreateHouseholdForm } from "./create-household-form";

/** Onboarding for signed-in people who aren't in a household yet. */
export default async function WelcomePage() {
  await connection();
  if (await (await getRepo()).getHousehold()) redirect("/");
  const invites = await (await getRepo()).getInvites();

  return (
    <div className="pt-[max(env(safe-area-inset-top),32px)]">
      <header className="px-5 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-ink">Welcome</p>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight">
          {invites.length ? "You've been invited" : "Set up your household"}
        </h1>
      </header>

      {invites.length > 0 ? (
        <div className="space-y-4">
          {invites.map((inv) => (
            <InviteCard key={inv.memberId} memberId={inv.memberId} ownerName={inv.ownerName} householdName={inv.householdName} />
          ))}
          <p className="px-6 text-center text-sm text-muted">
            Decline to start your own household instead.
          </p>
        </div>
      ) : (
        <CreateHouseholdForm />
      )}

      <form action={signOut} className="mt-10 flex justify-center">
        <button className="text-sm font-semibold text-muted underline-offset-2 hover:underline">Use a different number</button>
      </form>
    </div>
  );
}
