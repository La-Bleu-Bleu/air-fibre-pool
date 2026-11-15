"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Layers, SlidersHorizontal, Users } from "lucide-react";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/build", label: "Pool", icon: Layers },
  { href: "/allocate", label: "Allocate", icon: SlidersHorizontal },
  { href: "/household", label: "Household", icon: Users },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[440px] px-4 pb-[max(env(safe-area-inset-bottom),12px)]"
    >
      <ul className="flex items-center justify-between rounded-[1.75rem] border border-border bg-surface/90 px-2 py-2 shadow-lg shadow-brand-900/10 backdrop-blur-xl">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-semibold transition-colors ${
                  active ? "bg-brand-100 text-brand-ink" : "text-muted hover:text-foreground"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
