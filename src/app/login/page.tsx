import { redirect } from "next/navigation";
import { PlayCircle, Wifi } from "lucide-react";
import { enterDemo } from "@/app/actions";
import { demoForced } from "@/lib/mode";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  if (demoForced) redirect("/");

  return (
    <div className="flex min-h-dvh flex-col">
      <section className="bg-brand-gradient relative overflow-hidden rounded-b-[2rem] px-6 pt-[max(env(safe-area-inset-top),48px)] pb-12 text-white">
        <div className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-white/10 blur-2xl" />
        <span className="grid size-14 place-items-center rounded-2xl bg-white/20 backdrop-blur">
          <Wifi size={26} />
        </span>
        <h1 className="mt-6 text-[32px] font-extrabold leading-tight tracking-tight">
          One data pool
          <br />
          for your whole home
        </h1>
        <p className="mt-3 max-w-[30ch] text-white/85">
          Share 5G data between your Air Fibre and your family&apos;s Dialog lines.
        </p>
      </section>

      <div className="flex-1 px-6 pt-8 pb-10">
        <LoginForm />

        <div className="my-8 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <form action={enterDemo}>
          <button className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface font-bold transition hover:border-brand-500">
            <PlayCircle size={18} className="text-brand-ink" />
            Explore the demo
          </button>
        </form>
        <p className="mt-2 text-center text-xs text-muted">A sample family of five. No sign-in needed.</p>
      </div>
    </div>
  );
}
