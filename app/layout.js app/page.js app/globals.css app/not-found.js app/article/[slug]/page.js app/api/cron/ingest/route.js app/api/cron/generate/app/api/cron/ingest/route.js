// app/api/cron/ingest/route.js
import { getServiceClient } from "@/lib/supabase";
import { SOURCES, fetchFeed } from "@/lib/feeds";
import { hashContent } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function isAuthorized(req) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }
  return !process.env.CRON_SECRET;
}

export async function GET(req) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const results = { sources: 0, newItems: 0, duplicates: 0, errors: [] };

  const fetchResults = await Promise.all(
    SOURCES.map(async (source) => ({ source, ...(await fetchFeed(source)) }))
  );

  for (const { source, items, error } of fetchResults) {
    results.sources++;
    if (error) {
      results.errors.push(`${source.name}: ${error}`);
      continue;
    }
    for (const item of items) {
      if (!item.title || !item.link) continue;
      const content_hash = hashContent(item.title, item.link);
      const { error: insertError } = await supabase.from("raw_sources").insert({
        source_name: source.name,
        source_url: item.link,
        title: item.title.slice(0, 500),
        raw_content: item.content,
        content_hash,
        published_at: item.published || null,
      });
      if (insertError) {
        if (insertError.code === "23505") {
          results.duplicates++;
        } else {
          results.errors.push(`${source.name} insert: ${insertError.message}`);
        }
      } else {
        results.newItems++;
      }
    }
  }

  return Response.json({ success: true, ...results, timestamp: new Date().toISOString() });
}
