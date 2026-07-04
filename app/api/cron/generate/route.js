import { getServiceClient } from "@/lib/supabase";
import { generateArticle } from "@/lib/generate";
import { makeSlug } from "@/lib/utils";
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
      const { error: insertError } = await supabase.from("articles").insert({
        slug, title: articleData.title, summary: articleData.summary, content: articleData.content,
        tags: articleData.tags || [], source_urls: [source.source_url],
        category: articleData.category || "general", severity: articleData.severity || null, cve_ids: articleData.cve_ids || [],
      });
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
