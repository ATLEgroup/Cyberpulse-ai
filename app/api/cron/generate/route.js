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

const MODEL = "claude-sonnet-4-6";
const SYSTEM_PROMPT = `You are a senior cybersecurity journalist writing for CyberPulse AI.
Your task: read raw information about a cybersecurity news item and produce an ORIGINAL article.
RULES: Write 100% original content. Only state facts in the source. Never invent details.
Write for security practitioners. Cover: what happened, why it matters, what to do.
Include CVE IDs exactly as they appear.
RESPOND WITH ONLY valid JSON, no markdown fences:
{"title":"headline under 90 chars","summary":"2-3 sentence summary","content":"full article min 300 words with sections: Overview, Technical Details, Impact, What You Should Do","tags":["5 to 8 lowercase tags"],"category":"cve|malware|breach|apt|advisory|research|tool|legislation|general","severity":"critical|high|medium|low|informational|null","cve_ids":["CVE-YYYY-NNNNN"]}`;
async function generateArticle(apiKey, source) {
  const snippet = (source.raw_content || "").slice(0, 3000);
  const userMsg = `SOURCE: ${source.source_name}\nURL: ${source.source_url}\nTITLE: ${source.title}\nPUBLISHED: ${source.published_at || "Unknown"}\nCONTENT:\n${snippet}\n\nWrite the JSON now.`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 2048, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userMsg }] }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    if (errBody.includes("credit balance is too low")) { const e = new Error("NO_CREDIT"); e.code = "NO_CREDIT"; throw e; }
    if (res.status === 401) throw new Error("API key rejected — check ANTHROPIC_API_KEY in Vercel env vars.");
    if (res.status === 429) throw new Error("Rate limited — will retry on next cron run.");
    throw new Error(`API error ${res.status}: ${errBody.slice(0, 300)}`);
  }
  const body = await res.json();
  let rawText = (body.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  if (rawText.startsWith("```")) { rawText = rawText.split("\n").slice(1).join("\n").replace(/```\s*$/, "").trim(); }
  let parsed;
  try { parsed = JSON.parse(rawText); } catch (e) { throw new Error(`AI returned invalid JSON: ${e.message}`); }
  for (const field of ["title", "summary", "content", "tags", "category"]) {
    if (!parsed[field]) throw new Error(`AI response missing field: ${field}`);
  }
  return parsed;
}




export const dynamic = "force-dynamic";
export const maxDuration = 30;
const MAX_PER_RUN = 2;
function isAuthorized(req) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  return !process.env.CRON_SECRET;
}
async function uniqueSlug(supabase, title) {
  const base = makeSlug(title);
  let slug = base;
  let attempt = 0;
  while (true) {
    const { data } = await supabase.from("articles").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}
export async function GET(req) {
  if (!isAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  const supabase = getServiceClient();
  const { data: sources, error: fetchError } = await supabase.from("raw_sources").select("*").eq("processed", 0).order("ingested_at", { ascending: true }).limit(MAX_PER_RUN);
  if (fetchError) return Response.json({ error: fetchError.message }, { status: 500 });
  if (!sources || sources.length === 0) return Response.json({ success: true, generated: 0, message: "No unprocessed sources" });
  let generated = 0;
  let failed = 0;
  const errors = [];
  for (const source of sources) {
    try {
      const articleData = await generateArticle(apiKey, source);
      const slug = await uniqueSlug(supabase, articleData.title);
      const { error: insertError } = await supabase.from("articles").insert({ slug, title: articleData.title, summary: articleData.summary, content: articleData.content, tags: articleData.tags || [], source_urls: [source.source_url], category: articleData.category || "general", severity: articleData.severity || null, cve_ids: articleData.cve_ids || [] });
      if (insertError) throw new Error(insertError.message);
      await supabase.from("raw_sources").update({ processed: 1 }).eq("id", source.id);
      generated++;
    } catch (err) {
      if (err.code === "NO_CREDIT") { errors.push("NO_CREDIT"); break; }
      await supabase.from("raw_sources").update({ processed: 2 }).eq("id", source.id);
      failed++;
      errors.push(`${source.title.slice(0, 50)}: ${err.message}`);
    }
  }
  return Response.json({ success: true, generated, failed, errors, timestamp: new Date().toISOString() });
}
