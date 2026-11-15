import { redirect } from "next/navigation";
import { Wifi } from "lucide-react";
import { isDemoMode } from "@/lib/mode";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  if (isDemoMode) redirect("/");

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
      <LoginForm />
    </div>
  );
}
