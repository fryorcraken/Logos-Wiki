const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const at = (ts: number) => new Date(ts);
const pad = (n: number) => String(n).padStart(2, "0");

export const formatDate = (ts: number) => `${at(ts).getUTCDate()} ${MONTHS[at(ts).getUTCMonth()]} ${at(ts).getUTCFullYear()}`;
export const formatTime = (ts: number) => `${pad(at(ts).getUTCHours())}:${pad(at(ts).getUTCMinutes())}`;
export const formatDateTime = (ts: number) => `${formatTime(ts)}, ${formatDate(ts)}`;
export const isoSeconds = (ts: number) => at(ts).toISOString().replace(/\.\d{3}Z$/, "Z");

export const formatNumber = (n: number) => n.toLocaleString("en");

export function formatBytes(n: number) {
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export const byteLength = (s: string) => new TextEncoder().encode(s).length;
