import { WINDOW_OPTIONS, type WindowSeconds } from "@/config";
import { cn } from "@/lib/utils";

interface TimeWindowProps {
	value: WindowSeconds;
	onChange(value: WindowSeconds): void;
}

export function TimeWindow({ value, onChange }: TimeWindowProps) {
	return (
		<fieldset className="pointer-events-auto flex items-stretch border border-border bg-panel">
			<legend className="sr-only">Time window</legend>
			<span className="label-caps flex items-center border-r border-border px-3 text-muted-foreground">
				Window
			</span>
			{WINDOW_OPTIONS.map((option) => {
				const selected = option.seconds === value;
				return (
					<button
						key={option.seconds}
						type="button"
						aria-pressed={selected}
						onClick={() => onChange(option.seconds)}
						className={cn(
							"focus-ring label-caps px-3 py-2 transition-colors duration-200",
							selected
								? "bg-foreground text-background"
								: "hover:bg-foreground/10",
						)}
					>
						{option.label}
					</button>
				);
			})}
		</fieldset>
	);
}
