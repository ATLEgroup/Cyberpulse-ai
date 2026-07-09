import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
function getPublicClient() { return createClient(url, anonKey); }
function severityColor(s) { const m={critical:"#dc2626",high:"#ea580c",medium:"#ca8a04",low:"#16a34a",informational:"#6366f1"}; return m[s]||"#6b7280"; }
function formatDate(d) { if(!d)return""; try{return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});}catch{return"";} }
export const revalidate = 300;
const CATS=["cve","malware","breach","apt","advisory","research","tool","legislation","general"];
const PER_PAGE=12;
function SeverityBadge({severity}){if(!severity)return null;return<span className="badge"style={{background:severityColor(severity)}}>{severity.toUpperCase()}</span>;}
function CategoryBadge({category}){if(!category)return null;return<span className="badge-outline">{category}</span>;}
export default async function HomePage({searchParams:sp}){
const p=await sp;
const page=Math.max(1,parseInt(p?.page||"1",10));
const category=(p?.category||"").trim();
const offset=(page-1)*PER_PAGE;
const supabase=getPublicClient();
let query=supabase.from("articles").select("id,slug,title,summary,tags,category,severity,cve_ids,published_at,view_count",{count:"exact"}).order("published_at",{ascending:false}).range(offset,offset+PER_PAGE-1);
if(category)query=query.eq("category",category);
const{data:articles,count}=await query;
const total=count||0;
const totalPages=Math.max(1,Math.ceil(total/PER_PAGE));
return(<><header className="hdr"><div className="inner"><a href="/"className="logo">CYBER<span>PULSE</span> AI</a><span className="tagline">AI-POWERED THREAT INTELLIGENCE</span></div></header><div className="hero"><div className="wrap"><h1><em>Threat Intelligence</em> — Automated &amp; AI-Analysed</h1><p>Real-time cybersecurity news and CVE analysis, written by AI from trusted sources.</p><div className="filters"><a href="/"className={`fbtn ${!category?"on":""}`}>ALL</a>{CATS.map((c)=><a key={c}href={`/?category=${c}`}className={`fbtn ${category===c?"on":""}`}>{c}</a>)}</div></div></div><div className="wrap"style={{paddingTop:0}}>{!articles||articles.length===0?(<div className="empty"><h2>No articles yet</h2><p>New articles are generated automatically every day. Check back shortly.</p></div>):(<div className="grid">{articles.map((a)=>(<article key={a.id}className="card"><div className="card-meta"><SeverityBadge severity={a.severity}/><CategoryBadge category={a.category}/></div><a href={`/article/${a.slug}`}className="card-title">{a.title}</a><p className="card-summary">{(a.summary||"").slice(0,155)}...</p><div className="tags">{(a.tags||[]).slice(0,4).map((t)=><span key={t}className="tag">{t}</span>)}{(a.cve_ids||[]).slice(0,2).map((c)=><span key={c}className="cve">{c}</span>)}</div><div className="card-footer"><span>{formatDate(a.published_at)}</span>{a.view_count>0&&<span>{a.view_count} views</span>}</div></article>))}</div>)}{totalPages>1&&(<div className="pager"><a href={`/?page=${page-1}${category?`&category=${category}`:""}`}className={`pbtn ${page<=1?"off":""}`}>&#8592; Prev</a><span className="pbtn cur">{page} / {totalPages}</span><a href={`/?page=${page+1}${category?`&category=${category}`:""}`}className={`pbtn ${page>=totalPages?"off":""}`}>Next &#8594;</a></div>)}</div><footer className="ftr">CyberPulse AI — AI-generated cybersecurity intelligence. Always verify with primary sources.</footer></>);
}
