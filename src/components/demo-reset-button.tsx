"use client";

/**
 * Submit button for the demo-reset forms (Reset demo data, Explore the demo, Exit demo).
 * Also clears the Dia chats saved in this browser tab, so they don't refer to data that no longer exists.
 */
export function DemoResetButton({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <button type="submit" className={className} onClick={clearDiaChats}>
      {children}
    </button>
  );
}

export function clearDiaChats() {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith("dia:")) sessionStorage.removeItem(key);
  } catch {
    // storage unavailable: nothing to clear
  }
}
