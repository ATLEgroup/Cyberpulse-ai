// lib/generate.js
const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a senior cybersecurity journalist writing for CyberPulse AI, a professional threat intelligence platform.

Your task: read raw information about a cybersecurity news item and produce an ORIGINAL, professionally written article.

STRICT RULES:
- Write 100% original content. Never copy or closely paraphrase the source text.
- Only state facts clearly present in the source. Do not invent CVE scores, vendor names, or technical details.
- Write for a security-practitioner audience: clear, authoritative, technically accurate.
- Every article must cover: What happened, Why it matters, What affected users should do.
- Include any CVE IDs exactly as they appear in the source.

RESPOND WITH ONLY a single valid JSON object. No markdown fences. No text before or after the JSON.

Required JSON fields:
{
  "title": "Clear, specific headline under 90 characters",
  "summary": "2-3 sentence executive summary (plain text)",
  "content": "Full article in plain text with newlines. Min 300 words. Include sections: Overview, Technical Details, Impact, What You Should Do.",
  "tags": ["5 to 8 lowercase tags"],
  "category": "one of: cve | malware | breach | apt | advisory | research | tool | legislation | general",
  "severity": "one of: critical | high | medium | low | informational | null",
  "cve_ids": ["CVE-YYYY-NNNNN or empty array"]
}`;

export async function generateArticle(apiKey, source) {
  const snippet = (source.raw_content || "").slice(0, 3000);
  const userMsg = `SOURCE: ${source.source_name}
URL: ${source.source_url}
TITLE: ${source.title}
PUBLISHED: ${source.published_at || "Unknown"}
CONTENT SNIPPET:
${snippet}

Write the original cybersecurity article JSON now.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMsg }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    if (errBody.includes("credit balance is too low")) {
      const e = new Error("NO_CREDIT");
      e.code = "NO_CREDIT";
      throw e;
    }
    if (res.status === 401) {
      throw new Error("API key was rejected (401) — check ANTHROPIC_API_KEY in Vercel env vars.");
    }
    if (res.status === 429) {
      throw new Error("Rate limited by the API (429) — will retry on next cron run.");
    }
    throw new Error(`API error ${res.status}: ${errBody.slice(0, 300)}`);
  }

  const body = await res.json();
  let rawText = (body.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (rawText.startsWith("\`\`\`")) {
    rawText = rawText.split("\n").slice(1).join("\n");
    rawText = rawText.replace(/\`\`\`\s*$/, "").trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    throw new Error(`AI returned invalid JSON: ${e.message}`);
  }

  for (const field of ["title", "summary", "content", "tags", "category"]) {
    if (!parsed[field]) {
      throw new Error(`AI response missing required field: ${field}`);
    }
  }

  return parsed;
}
