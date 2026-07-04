const MODEL = "claude-sonnet-4-6";
const SYSTEM_PROMPT = `You are a senior cybersecurity journalist writing for CyberPulse AI.
Your task: read raw information about a cybersecurity news item and produce an ORIGINAL article.
RULES: Write 100% original content. Only state facts in the source. Never invent details.
Write for security practitioners. Cover: what happened, why it matters, what to do.
Include CVE IDs exactly as they appear.
RESPOND WITH ONLY valid JSON, no markdown fences:
{"title":"headline under 90 chars","summary":"2-3 sentence summary","content":"full article min 300 words with sections: Overview, Technical Details, Impact, What You Should Do","tags":["5 to 8 lowercase tags"],"category":"cve|malware|breach|apt|advisory|research|tool|legislation|general","severity":"critical|high|medium|low|informational|null","cve_ids":["CVE-YYYY-NNNNN"]}`;
export async function generateArticle(apiKey, source) {
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
