"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Layers, SlidersHorizontal, Users } from "lucide-react";

const allTabs = [
  { href: "/", label: "Home", icon: Home, ownerOnly: false },
  { href: "/build", label: "Pool", icon: Layers, ownerOnly: true },
  { href: "/allocate", label: "Allocate", icon: SlidersHorizontal, ownerOnly: true },
  { href: "/household", label: "Household", icon: Users, ownerOnly: false },
] as const;

const matches = (href: string, pathname: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

/** Bottom tab bar. Members only see the tabs they can use; owners see everything. */
export function BottomNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  // Highlight the tapped tab immediately, before the next page has loaded. It falls back to the
  // URL as soon as the navigation completes (the pathname changes), so no cleanup is needed.
  const [tapped, setTapped] = useState<{ href: string; from: string } | null>(null);

  // Sign-in and onboarding are full-screen flows.
  if (pathname === "/login" || pathname === "/welcome") return null;

  const tabs = allTabs.filter((t) => isOwner || !t.ownerOnly);
  const activeHref =
    tapped && tapped.from === pathname ? tapped.href : (tabs.find((t) => matches(t.href, pathname))?.href ?? null);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[440px] px-4 pb-[max(env(safe-area-inset-bottom),12px)]"
    >
      <ul className="flex items-center justify-between rounded-[1.75rem] border border-border bg-surface/90 px-2 py-2 shadow-lg shadow-brand-900/10 backdrop-blur-xl">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === activeHref;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                onClick={() => setTapped({ href, from: pathname })}
                aria-current={matches(href, pathname) ? "page" : undefined}
                className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-semibold transition-colors duration-100 ${
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
