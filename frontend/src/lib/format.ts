/** "12 km", "850 m". */
export function formatDistance(metres: number): string {
	if (metres >= 10_000) return `${Math.round(metres / 1000)} km`;
	if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
	return `${Math.round(metres)} m`;
}

/** "51.51°N 0.13°W". */
export function formatCoordinates(longitude: number, latitude: number): string {
	const lat = `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? "N" : "S"}`;
	const lon = `${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? "E" : "W"}`;
	return `${lat} ${lon}`;
}

/** "3 Oct 14:05 UTC". */
export function formatUtc(unixSeconds: number): string {
	const d = new Date(unixSeconds * 1000);
	const day = d.getUTCDate();
	const month = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
	const hh = String(d.getUTCHours()).padStart(2, "0");
	const mm = String(d.getUTCMinutes()).padStart(2, "0");
	return `${day} ${month} ${hh}:${mm} UTC`;
}

/** "just now", "4 min ago", "3 h ago", "2 d ago". */
export function formatAge(unixSeconds: number, nowMs: number): string {
	const s = Math.max(0, Math.round(nowMs / 1000 - unixSeconds));
	if (s < 60) return "just now";
	if (s < 3600) return `${Math.floor(s / 60)} min ago`;
	if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
	return `${Math.floor(s / 86400)} d ago`;
}
