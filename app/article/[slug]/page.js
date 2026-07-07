import { getPublicClient, getServiceClient } from "../../lib/supabase";
import { formatDate, severityColor } from "../../lib/utils";
import { mdToHtml } from "../../lib/markdown";
import { notFound } from "next/navigation";
export const revalidate = 0;
function SeverityBadge({ severity }) {
  if (!severity) return null;
  return <span className="badge" style={{ background: severityColor(severity) }}>{severity.toUpperCase()}</span>;
}
export async function generateMetadata({ params: p }) {
  const params = await p;
  const supabase = getPublicClient();
  const { data: article } = await supabase.from("articles").select("title, summary").eq("slug", params.slug).maybeSingle();
  if (!article) return { title: "Not found" };
  return { title: article.title + " — CyberPulse AI", description: article.summary };
}
export default async function ArticlePage({ params: p }) {
  const params = await p;
  const { data: article } = await getPublicClient().from("articles").select("*").eq("slug", params.slug).maybeSingle();
  if (!article) notFound();
  try { await getServiceClient().from("articles").update({ view_count: (article.view_count||0)+1 }).eq("id", article.id); } catch {}
  return (
    <>
      <header className="hdr"><div className="inner"><a href="/" className="logo">CYBER<span>PULSE</span> AI</a></div></header>
      <div className="art">
        <a href="/" className="back">&#8592; Back</a>
        <div className="art-hdr">
          <h1>{article.title}</h1>
        </div>
        <div className="summary-box">{article.summary}</div>
        <div className="art-body" dangerouslySetInnerHTML={{ __html: mdToHtml(article.content||"") }} />
      </div>
      <footer className="ftr">CyberPulse AI</footer>
    </>
  );
}
