"use client";

import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";

/** A success banner that pops up above the tab bar and dismisses itself. Remount (change `key`) to show again. */
export function Toast({ children, onDone, ms = 3500 }: { children: React.ReactNode; onDone: () => void; ms?: number }) {
  useEffect(() => {
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [onDone, ms]);

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),12px)+92px)] z-30 mx-auto w-full max-w-[440px] px-4 animate-[toast-in_200ms_ease-out]"
    >
      <p className="flex items-center gap-2.5 rounded-2xl bg-foreground px-4 py-3 text-sm font-medium text-white shadow-xl shadow-brand-900/20">
        <CheckCircle2 size={18} className="shrink-0 text-success" aria-hidden />
        <span>{children}</span>
      </p>
    </div>
  );
}
