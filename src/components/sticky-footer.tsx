/** Action bar pinned above the bottom nav. Pages using it should add bottom padding (pb-56). */
export function StickyFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),12px)+84px)] z-10 mx-auto w-full max-w-[440px] px-4">
      <div className="rounded-[var(--radius-card)] border border-border bg-surface/95 p-4 shadow-xl shadow-brand-900/10 backdrop-blur-xl">
        {children}
      </div>
    </div>
  );
}
