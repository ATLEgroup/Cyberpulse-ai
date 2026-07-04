import { createHash } from "crypto";
export function hashContent(title, url) {
  return createHash("md5").update(`${title}::${url}`).digest("hex");
}
export function makeSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 100);
}
export function severityColor(severity) {
  const map = { critical: "#dc2626", high: "#ea580c", medium: "#ca8a04", low: "#16a34a", informational: "#6366f1" };
  return map[severity] || "#6b7280";
}
export function formatDate(dateStr) {
  if (!dateStr) return "";
  try { return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return ""; }
}
