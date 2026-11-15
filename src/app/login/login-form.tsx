"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Info, Loader2 } from "lucide-react";
import { signInWithPhone } from "@/app/actions";
import { formatMsisdn, normaliseMsisdn, PHONE_EXAMPLE } from "@/lib/pricing";

/**
 * Two-step phone sign-in. PROTOTYPE: no SMS is sent and the code is always 123456
 * (see signInWithPhone in app/actions.ts).
 */
export function LoginForm() {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [number, setNumber] = useState("");
  const [msisdn, setMsisdn] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function next(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const target = normaliseMsisdn(number);
    if (!target) return setError(`Enter your mobile number, like ${PHONE_EXAMPLE}.`);
    setMsisdn(target);
    setCode("");
    setStep("code");
  }

  function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code.");
    startTransition(async () => {
      const result = await signInWithPhone(msisdn, code);
      if (result?.error) setError(result.error);
    });
  }

  const field =
    "h-14 w-full rounded-2xl border border-border bg-surface px-4 text-lg font-semibold tracking-wide outline-none transition placeholder:font-normal placeholder:text-muted/70 focus:border-brand-500";
  const primary =
    "bg-brand-gradient flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white shadow-lg shadow-brand-600/30 transition active:scale-[0.99] disabled:opacity-70";

  return step === "phone" ? (
    <form onSubmit={next} className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Sign in with your mobile</h2>
        <p className="mt-1 text-sm text-muted">Sri Lankan or Malaysian numbers.</p>
      </div>
      <label className="block">
        <span className="sr-only">Mobile number</span>
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
      <button type="submit" className={primary}>
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
        <p className="mt-1 text-sm text-muted">For {formatMsisdn(msisdn)}</p>
      </div>
      <p className="flex items-start gap-2 rounded-xl bg-brand-100 px-3 py-2.5 text-sm text-brand-ink">
        <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          Prototype: no SMS is sent. Use code <b className="tracking-wider">123456</b>.
        </span>
      </p>
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
    </form>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
      {children}
    </p>
  );
}
