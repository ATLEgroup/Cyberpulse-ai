// lib/feeds.js
export const SOURCES = [
  { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews" },
  { name: "Bleeping Computer", url: "https://www.bleepingcomputer.com/feed/" },
  { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/" },
  { name: "CISA Advisories", url: "https://www.cisa.gov/cybersecurity-advisories/feed.xml" },
  { name: "Dark Reading", url: "https://www.darkreading.com/rss.xml" },
  { name: "Schneier on Security", url: "https://www.schneier.com/feed/atom/" },
];

function stripHtml(raw) {
  if (!raw) return "";
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
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
    const content =
      stripHtml(extractTag(block, ["encoded", "description"])) ||
      stripHtml(extractTag(block, ["description"]));
    if (title && link) {
      items.push({ title, link, published: pubDate, content: content.slice(0, 8000) });
    }
  }
  return items;
}

function parseAtomEntries(xml) {
  const items = [];
  const entryBlocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const block of entryBlocks) {
    const title = stripHtml(extractTag(block, ["title"]));
    let link = extractAttr(block, ["link"], "href");
    const published = extractTag(block, ["published", "updated"]);
    const content =
      stripHtml(extractTag(block, ["content"])) || stripHtml(extractTag(block, ["summary"]));
    if (title && link) {
      items.push({ title, link, published, content: content.slice(0, 8000) });
    }
  }
  return items;
}

export function parseFeed(xmlText) {
  if (/<feed[\s>]/i.test(xmlText) && !/<rss[\s>]/i.test(xmlText)) {
    return parseAtomEntries(xmlText);
  }
  const rssItems = parseRssItems(xmlText);
  if (rssItems.length > 0) return rssItems;
  return parseAtomEntries(xmlText);
}

export async function fetchFeed(source) {
  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": "CyberPulse AI/1.0 (cybersecurity research aggregator)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      return { items: [], error: `HTTP ${res.status}` };
    }
    const text = await res.text();
    const items = parseFeed(text);
    return { items, error: null };
  } catch (err) {
    return { items: [], error: err.message };
  }
}
