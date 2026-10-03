import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { VIEWS } from "@/views/registry";
import type { ViewId } from "@/views/types";

interface ViewSwitcherProps {
	active: ViewId;
	onChange(view: ViewId): void;
}

/** One tab per registered view. Keys 1, 2, 3 switch views. */
export function ViewSwitcher({ active, onChange }: ViewSwitcherProps) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			const target = e.target as HTMLElement | null;
			if (target?.closest("input, textarea, [contenteditable]")) return;
			const view = VIEWS[Number(e.key) - 1];
			if (view) onChange(view.id);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onChange]);

	return (
		<div
			role="tablist"
			aria-label="Views"
			className="pointer-events-auto flex border border-border bg-panel"
		>
			{VIEWS.map((view, i) => {
				const selected = view.id === active;
				return (
					<button
						key={view.id}
						type="button"
						role="tab"
						aria-selected={selected}
						onClick={() => onChange(view.id)}
						className={cn(
							"focus-ring flex flex-col items-start gap-0.5 border-border px-3 py-2 text-left transition-colors duration-200 not-last:border-r",
							selected
								? "bg-foreground text-background"
								: "hover:bg-foreground/10",
						)}
					>
						<span className="label-caps opacity-70">
							{i + 1} · {view.challenge}
						</span>
						<span className="font-display text-lg leading-none uppercase">
							{view.label}
						</span>
					</button>
				);
			})}
		</div>
	);
}
