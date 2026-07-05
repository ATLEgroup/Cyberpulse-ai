import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
function getServiceClient() {
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
function hashContent(title, u) {
  const str = title + "::" + u;
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
  return Math.abs(hash).toString(16);
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
  return raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}
function extractTag(block, tags) {
  for (const tag of tags) {
    const re = new RegExp(`<(?:[\\w]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[\\w]+:)?${tag}>`,"i");
    const m = block.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return "";
}
function parseItems(xml) {
  const items = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = stripHtml(extractTag(b, ["title"]));
    let link = extractTag(b, ["link"]).trim();
    if (!link) { const m = b.match(/href=["']([^"']+)["']/); if (m) link = m[1]; }
    const content = stripHtml(extractTag(b, ["encoded","content","description","summary"]));
    const published = extractTag(b, ["pubDate","published","updated"]);
    if (title && link) items.push({ title, link, content: content.slice(0,8000), published });
  }
  return items;
}
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export async function GET(req) {
  const supabase = getServiceClient();
  const results = { sources: 0, newItems: 0, duplicates: 0, errors: [] };
  const fetchResults = await Promise.all(SOURCES.map(async (source) => {
    try {
      const res = await fetch(source.url, { headers: { "User-Agent": "CyberPulse AI/1.0" }, signal: AbortSignal.timeout(12000) });
      const text = await res.text();
      return { source, items: parseItems(text), error: null };
    } catch (e) { return { source, items: [], error: e.message }; }
  }));
  for (const { source, items, error } of fetchResults) {
    results.sources++;
    if (error) { results.errors.push(`${source.name}: ${error}`); continue; }
    for (const item of items) {
      if (!item.title || !item.link) continue;
      const content_hash = hashContent(item.title, item.link);
      const { error: insertError } = await supabase.from("raw_sources").insert({ source_name: source.name, source_url: item.link, title: item.title.slice(0,500), raw_content: item.content, content_hash, published_at: item.published || null });
      if (insertError) { if (insertError.code === "23505") results.duplicates++; else results.errors.push(`${source.name}: ${insertError.message}`); }
      else results.newItems++;
    }
  }
  return Response.json({ success: true, ...results, timestamp: new Date().toISOString() });
}
