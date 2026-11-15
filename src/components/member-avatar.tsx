import { Router, Smartphone } from "lucide-react";
import type { MemberKind } from "@/lib/types";

export function MemberAvatar({ kind, color, size = "md" }: { kind: MemberKind; color: string; size?: "sm" | "md" }) {
  const Icon = kind === "home" ? Router : Smartphone;
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-2xl text-white ${size === "sm" ? "size-8 rounded-xl" : "size-10"}`}
      style={{ background: color }}
    >
      <Icon size={size === "sm" ? 15 : 18} aria-hidden />
    </span>
  );
}
