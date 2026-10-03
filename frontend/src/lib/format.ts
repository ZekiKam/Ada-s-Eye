/** "12 km", "850 m". */
export function formatDistance(metres: number): string {
	if (metres >= 10_000) return `${Math.round(metres / 1000)} km`;
	if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
	return `${Math.round(metres)} m`;
}

/** "just now", "4 min ago", "3 h ago", "2 d ago". */
export function formatAge(unixSeconds: number, nowMs: number): string {
	const s = Math.max(0, Math.round(nowMs / 1000 - unixSeconds));
	if (s < 60) return "just now";
	if (s < 3600) return `${Math.floor(s / 60)} min ago`;
	if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
	return `${Math.floor(s / 86400)} d ago`;
}
