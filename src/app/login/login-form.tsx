"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { formatMsisdn, normaliseMsisdn } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/client";

const RESEND_SECONDS = 60;

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [number, setNumber] = useState("");
  const [msisdn, setMsisdn] = useState(""); // 94XXXXXXXXX once sent
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function sendCode(target = normaliseMsisdn(number)) {
    setError(undefined);
    if (!target) return setError("Enter your Dialog mobile number, like 077 123 4567.");
    startTransition(async () => {
      const { error } = await createClient().auth.signInWithOtp({ phone: `+${target}` });
      if (error)
        return setError(
          /phone provider/i.test(error.message)
            ? "Phone sign-in isn't switched on for this project yet. (Supabase → Authentication → Sign In / Providers → Phone)"
            : error.message,
        );
      setMsisdn(target);
      setCode("");
      setStep("code");
      setCooldown(RESEND_SECONDS);
    });
  }

  function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from the SMS.");
    startTransition(async () => {
      const { error } = await createClient().auth.verifyOtp({ phone: `+${msisdn}`, token: code, type: "sms" });
      if (error) return setError(error.message);
      router.replace("/");
      router.refresh();
    });
  }

  const field =
    "h-14 w-full rounded-2xl border border-border bg-surface px-4 text-lg font-semibold tracking-wide outline-none transition placeholder:font-normal placeholder:text-muted/70 focus:border-brand-500";
  const primary =
    "bg-brand-gradient flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white shadow-lg shadow-brand-600/30 transition active:scale-[0.99] disabled:opacity-70";

  return (
    <section className="flex-1 px-6 pt-8 pb-10">
      {step === "phone" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
          className="space-y-4"
        >
          <div>
            <h2 className="text-xl font-bold">Sign in with your mobile</h2>
            <p className="mt-1 text-sm text-muted">We&apos;ll text you a 6-digit code.</p>
          </div>
          <label className="block">
            <span className="sr-only">Dialog mobile number</span>
            <input
              autoFocus
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="077 123 4567"
              className={field}
            />
          </label>
          {error && <ErrorText>{error}</ErrorText>}
          <button type="submit" disabled={pending} className={primary}>
            {pending && <Loader2 size={18} className="animate-spin" />}
            Send code
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setError(undefined);
            }}
            className="-ml-1 flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground"
          >
            <ArrowLeft size={16} /> Change number
          </button>
          <div>
            <h2 className="text-xl font-bold">Enter your code</h2>
            <p className="mt-1 text-sm text-muted">Sent to {formatMsisdn(msisdn)}</p>
          </div>
          <label className="block">
            <span className="sr-only">6-digit code</span>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              className={`${field} text-center text-2xl tracking-[0.5em]`}
            />
          </label>
          {error && <ErrorText>{error}</ErrorText>}
          <button type="submit" disabled={pending || code.length !== 6} className={primary}>
            {pending && <Loader2 size={18} className="animate-spin" />}
            Sign in
          </button>
          <button
            type="button"
            disabled={pending || cooldown > 0}
            onClick={() => sendCode(msisdn)}
            className="w-full text-center text-sm font-semibold text-brand-ink disabled:text-muted"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </form>
      )}
    </section>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
      {children}
    </p>
  );
}
