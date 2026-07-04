import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
function getPublicClient() {
  return createClient(url, anonKey);
}
function getServiceClient() {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const SOURCES = [
  { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews" },
  { name: "Bleeping Computer", url: "https://www.bleepingcomputer.com/feed/" },
  { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/" },
  { name: "CISA Advisories", url: "https://www.cisa.gov/cybersecurity-advisories/feed.xml" },
  { name: "Dark Reading", url: "https://www.darkreading.com/rss.xml" },
  { name: "Schneier on Security", url: "https://www.schneier.com/feed/atom/" },
];
function stripHtml(raw) {
  if (!raw) return "";
  return raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}
function extractTag(block, tagNames) {
  for (const tag of tagNames) {
    const re = new RegExp(`<(?:[\\w]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[\\w]+:)?${tag}>`, "i");
    const match = block.match(re);
    if (match && match[1]) return match[1].trim();
  }
  return "";
}
function extractAttr(block, tagNames, attr) {
  for (const tag of tagNames) {
    const re = new RegExp(`<(?:[\\w]+:)?${tag}[^>]*\\s${attr}=["']([^"']+)["']`, "i");
    const match = block.match(re);
    if (match && match[1]) return match[1].trim();
  }
  return "";
}
function parseRssItems(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of itemBlocks) {
    const title = stripHtml(extractTag(block, ["title"]));
    const link = extractTag(block, ["link"]).trim();
    const pubDate = extractTag(block, ["pubDate", "date"]);
    const content = stripHtml(extractTag(block, ["encoded", "description"])) || stripHtml(extractTag(block, ["description"]));
    if (title && link) items.push({ title, link, published: pubDate, content: content.slice(0, 8000) });
  }
  return items;
}
function parseAtomEntries(xml) {
  const items = [];
  const entryBlocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const block of entryBlocks) {
    const title = stripHtml(extractTag(block, ["title"]));
    const link = extractAttr(block, ["link"], "href");
    const published = extractTag(block, ["published", "updated"]);
    const content = stripHtml(extractTag(block, ["content"])) || stripHtml(extractTag(block, ["summary"]));
    if (title && link) items.push({ title, link, published, content: content.slice(0, 8000) });
  }
  return items;
}
function parseFeed(xmlText) {
  if (/<feed[\s>]/i.test(xmlText) && !/<rss[\s>]/i.test(xmlText)) return parseAtomEntries(xmlText);
  const rssItems = parseRssItems(xmlText);
  if (rssItems.length > 0) return rssItems;
  return parseAtomEntries(xmlText);
}
async function fetchFeed(source) {
  try {
    const res = await fetch(source.url, { headers: { "User-Agent": "CyberPulse AI/1.0" }, signal: AbortSignal.timeout(12000) });
    if (!res.ok) return { items: [], error: `HTTP ${res.status}` };
    const text = await res.text();
    return { items: parseFeed(text), error: null };
  } catch (err) {
    return { items: [], error: err.message };
  }
}

import { createHash } from "crypto";
function hashContent(title, url) {
  return createHash("md5").update(`${title}::${url}`).digest("hex");
}
function makeSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 100);
}
function severityColor(severity) {
  const map = { critical: "#dc2626", high: "#ea580c", medium: "#ca8a04", low: "#16a34a", informational: "#6366f1" };
  return map[severity] || "#6b7280";
}
function formatDate(dateStr) {
  if (!dateStr) return "";
  try { return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return ""; }
}




export const dynamic = "force-dynamic";
export const maxDuration = 30;
function isAuthorized(req) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  return !process.env.CRON_SECRET;
}
export async function GET(req) {
  if (!isAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getServiceClient();
  const results = { sources: 0, newItems: 0, duplicates: 0, errors: [] };
  const fetchResults = await Promise.all(SOURCES.map(async (source) => ({ source, ...(await fetchFeed(source)) })));
  for (const { source, items, error } of fetchResults) {
    results.sources++;
    if (error) { results.errors.push(`${source.name}: ${error}`); continue; }
    for (const item of items) {
      if (!item.title || !item.link) continue;
      const content_hash = hashContent(item.title, item.link);
      const { error: insertError } = await supabase.from("raw_sources").insert({ source_name: source.name, source_url: item.link, title: item.title.slice(0, 500), raw_content: item.content, content_hash, published_at: item.published || null });
      if (insertError) {
        if (insertError.code === "23505") results.duplicates++;
        else results.errors.push(`${source.name}: ${insertError.message}`);
      } else results.newItems++;
    }
  }
  return Response.json({ success: true, ...results, timestamp: new Date().toISOString() });
}
