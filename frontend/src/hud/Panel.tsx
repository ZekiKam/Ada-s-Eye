import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Flat, square, hairline-bordered HUD panel with a mono caps heading. */
export function Panel({
  title,
  aside,
  className,
  children,
}: {
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "pointer-events-auto flex min-h-0 flex-col border border-border bg-panel",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <h2 className="label-caps">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** Explicit empty state, so a panel is never blank. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 py-4 font-mono text-xs text-muted-foreground uppercase tracking-wider">
      {children}
    </p>
  );
}
