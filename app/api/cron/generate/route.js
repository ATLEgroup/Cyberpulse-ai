import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
function getServiceClient() {
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
function makeSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g,"").trim().replace(/\s+/g,"-").replace(/-+/g,"-").slice(0,100);
}
const MODEL = "claude-sonnet-4-6";
const SYSTEM_PROMPT = `You are a senior cybersecurity journalist. Write an ORIGINAL article based on the source. Respond ONLY with valid JSON: {"title":"headline under 90 chars","summary":"2-3 sentence summary","content":"full article min 300 words with sections Overview, Technical Details, Impact, What You Should Do","tags":["5-8 lowercase tags"],"category":"cve|malware|breach|apt|advisory|research|tool|legislation|general","severity":"critical|high|medium|low|informational|null","cve_ids":["CVE-YYYY-NNNNN"]}`;
async function generateArticle(apiKey, source) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 2048, system: SYSTEM_PROMPT, messages: [{ role: "user", content: `SOURCE: ${source.source_name}\nURL: ${source.source_url}\nTITLE: ${source.title}\nCONTENT:\n${(source.raw_content||"").slice(0,3000)}\n\nWrite the JSON now.` }] }),
  });
  if (!res.ok) { const e = await res.text(); if (e.includes("credit balance")) { const err = new Error("NO_CREDIT"); err.code = "NO_CREDIT"; throw err; } throw new Error(`API ${res.status}`); }
  const body = await res.json();
  let raw = (body.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").trim();
  if (raw.startsWith("```")) raw = raw.split("\n").slice(1).join("\n").replace(/```\s*$/,"").trim();
  return JSON.parse(raw);
}
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const MAX_PER_RUN = 2;
export async function GET(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  const supabase = getServiceClient();
  const { data: sources, error: fetchError } = await supabase.from("raw_sources").select("*").eq("processed",0).order("ingested_at",{ascending:true}).limit(MAX_PER_RUN);
  if (fetchError) return Response.json({ error: fetchError.message }, { status: 500 });
  if (!sources||sources.length===0) return Response.json({ success:true, generated:0, message:"No unprocessed sources" });
  let generated=0, failed=0;
  const errors=[];
  for (const source of sources) {
    try {
      const data = await generateArticle(apiKey, source);
      const base = makeSlug(data.title);
      let slug = base, attempt = 0;
      while (true) { const {data:ex} = await supabase.from("articles").select("id").eq("slug",slug).maybeSingle(); if (!ex) break; slug=`${base}-${++attempt}`; }
      const { error: ie } = await supabase.from("articles").insert({ slug, title:data.title, summary:data.summary, content:data.content, tags:data.tags||[], source_urls:[source.source_url], category:data.category||"general", severity:data.severity||null, cve_ids:data.cve_ids||[] });
      if (ie) throw new Error(ie.message);
      await supabase.from("raw_sources").update({processed:1}).eq("id",source.id);
      generated++;
    } catch(err) {
      if (err.code==="NO_CREDIT") { errors.push("NO_CREDIT"); break; }
      await supabase.from("raw_sources").update({processed:2}).eq("id",source.id);
      failed++;
      errors.push(`${source.title.slice(0,50)}: ${err.message}`);
    }
  }
  return Response.json({ success:true, generated, failed, errors, timestamp:new Date().toISOString() });
}
