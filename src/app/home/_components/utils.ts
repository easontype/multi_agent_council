export const STATUS_DOT: Record<string, string> = {
  concluded: "#22c55e",
  running: "#a78bfa",
  pending: "#f59e0b",
  failed: "#ef4444",
};

export const STATUS_LABEL: Record<string, string> = {
  concluded: "Concluded",
  running: "Running",
  pending: "Pending",
  failed: "Failed",
};

export function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
