// lib/markdown.js
function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMd(text) {
  text = esc(text);
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
  text = text.replace(/`(.+?)`/g, "<code>$1</code>");
  return text;
}

export function mdToHtml(text) {
  if (!text) return "";
  const lines = text.split("\n");
  const out = [];
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine;
    if (/^##\s/.test(line) || /^#\s/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${esc(line.replace(/^#+\s*/, ""))}</h2>`);
    } else if (/^###\s/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3>${esc(line.replace(/^###\s*/, ""))}</h3>`);
    } else if (/^[-*]\s/.test(line)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inlineMd(line.replace(/^[-*]\s/, ""))}</li>`);
    } else if (/^\d+\.\s/.test(line)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inlineMd(line.replace(/^\d+\.\s/, ""))}</li>`);
    } else if (line.trim() === "") {
      if (inList) { out.push("</ul>"); inList = false; }
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p>${inlineMd(line)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}
