/**
 * Semantic colour slots. The values live as CSS variables in src/index.css
 * (`--tone-<name>`), so the interface and the globe always agree.
 */
export const TONES = [
	"neutral",
	"info",
	"positive",
	"warning",
	"danger",
	"accent1",
	"accent2",
	"accent3",
	"accent4",
] as const;

export type Tone = (typeof TONES)[number];

/** CSS reference for use in style props. */
export function toneVar(tone: Tone): string {
	return `var(--tone-${tone})`;
}

const cache = new Map<Tone, string>();

/** Resolved colour string for three.js, read once from the CSS variables. */
export function toneColor(tone: Tone): string {
	const cached = cache.get(tone);
	if (cached) return cached;
	const value = getComputedStyle(document.documentElement)
		.getPropertyValue(`--tone-${tone}`)
		.trim();
	const color = value || "#ffffff";
	cache.set(tone, color);
	return color;
}
