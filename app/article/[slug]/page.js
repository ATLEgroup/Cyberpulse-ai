import { getPublicClient, getServiceClient } from "../../lib/supabase";
import { formatDate, severityColor } from "../../lib/utils";
import { mdToHtml } from "../../lib/markdown";
import { notFound } from "next/navigation";
export const revalidate = 0;
function SeverityBadge({ severity }) {
  if (!severity) return null;
  return <span className="badge" style={{ background: severityColor(severity) }}>{severity.toUpperCase()}</span>;
}
export async function generateMetadata({ params: paramsPromise }) {
  const params = await paramsPromise;
  const supabase = getPublicClient();
  const { data: article } = await supabase.from("articles").select("title, summary").eq("slug", params.slug).maybeSingle();
  if (!article) return { title: "Not found — CyberPulse AI" };
  return { title: `${article.title} — CyberPulse AI`, description: article.summary };
}
export default async function ArticlePage({ params: paramsPromise }) {
  const params = await paramsPromise;
  const publicClient = getPublicClient();
  const { data: article } = await publicClient.from("articles").select("*").eq("slug", params.slug).maybeSingle();
  if (!article) notFound();
  try {
    const serviceClient = getServiceClient();
    await serviceClient.from("articles").update({ view_count: (article.view_count || 0) + 1 }).eq("id", article.id);
  } catch {}
  const contentHtml = mdToHtml(article.content || "");
  return (
    <>
      <header className="hdr">
        <div className="inner">
          <a href="/" className="logo">CYBER<span>PULSE</span> AI</a>
          <span className="tagline">AI-POWERED THREAT INTELLIGENCE</span>
        </div>
      </header>
      <div className="art">
        <a href="/" className="back">&#8592; Back to Intelligence Feed</a>
        <div className="art-hdr">
          <div className="art-meta">
            <SeverityBadge severity={article.severity} />
            {article.category && <span className="badge-outline">{article.category}</span>}
            <span>{formatDate(article.published_at)}</span>
            {article.view_count > 0 && <span>{article.view_count} views</span>}
          </div>
          <h1>{article.title}</h1>
          <div className="tags" style={{ marginTop: "0.45rem" }}>
            {(article.tags || []).map((t) => <span key={t} className="tag">{t}</span>)}
            {(article.cve_ids || []).map((c) => <span key={c} className="cve">{c}</span>)}
          </div>
        </div>
        <div className="summary-box">{article.summary}</div>
        <div className="art-body" dangerouslySetInnerHTML={{ __html: contentHtml }} />
        {article.source_urls && article.source_urls.length > 0 && (
          <div className="sources">
            <h4>Sources &amp; References</h4>
            <ul>
              {article.source_urls.map((u) => <li key={u}><a href={u} target="_blank" rel="noopener noreferrer">{u}</a></li>)}
            </ul>
          </div>
        )}
      </div>
      <footer className="ftr">CyberPulse AI — Always verify with primary sources.</footer>
    </>
  );
}
