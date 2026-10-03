import { ChevronUp, type LucideIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Open from the start only where both bottom panels fit beside each other
 * and there is height to spare for the globe; a phone starts with chips.
 */
const OPEN_FROM = "(min-width: 48rem) and (min-height: 40rem)";

interface HudPanelProps {
	icon: LucideIcon;
	title: string;
	/** Shown under the title while open. */
	subtitle: string;
	/** Right-aligned panels push themselves to the right edge when closed. */
	align?: "left" | "right";
	children: ReactNode;
}

/**
 * A bottom-corner panel in the leaderboard's style. Closed, it shrinks to its
 * title; open, it grows upwards from the timeline.
 */
export function HudPanel({
	icon: Icon,
	title,
	subtitle,
	align = "left",
	children,
}: HudPanelProps) {
	const [open, setOpen] = useState(() => window.matchMedia(OPEN_FROM).matches);
	const bodyId = useId();

	return (
		<section
			className={cn(
				"pointer-events-auto engraved flex max-w-full flex-col border border-border bg-panel transition-colors duration-150 has-[>button:hover]:border-foreground",
				open ? "w-80" : "w-fit",
				align === "right" && "ml-auto",
			)}
		>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={bodyId}
				onClick={() => setOpen((o) => !o)}
				className="focus-ring flex items-center gap-3 py-2 pr-3 pl-3 text-left"
			>
				<Icon aria-hidden className="size-5 shrink-0" />
				<span className="flex flex-1 flex-col gap-1">
					<span className="font-display text-xl leading-none uppercase">
						{title}
					</span>
					{open && (
						<span className="label-caps text-muted-foreground">{subtitle}</span>
					)}
				</span>
				<ChevronUp
					aria-hidden
					className={cn(
						"size-4 shrink-0 transition-transform",
						open && "rotate-180",
					)}
				/>
			</button>
			{open && (
				<div id={bodyId} className="border-t border-border px-3 py-2.5">
					{children}
				</div>
			)}
		</section>
	);
}
