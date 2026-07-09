import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
function getPublicClient(){return createClient(url,anonKey);}
function getServiceClient(){return createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});}
function severityColor(s){const m={critical:"#dc2626",high:"#ea580c",medium:"#ca8a04",low:"#16a34a",informational:"#6366f1"};return m[s]||"#6b7280";}
function formatDate(d){if(!d)return"";try{return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});}catch{return"";}}
function mdToHtml(text){if(!text)return"";const lines=text.split("\n");const out=[];let inList=false;function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}function inline(t){t=esc(t);t=t.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");t=t.replace(/\*(.+?)\*/g,"<em>$1</em>");t=t.replace(/`(.+?)`/g,"<code>$1</code>");return t;}for(const line of lines){if(/^##?\s/.test(line)){if(inList){out.push("</ul>");inList=false;}out.push(`<h2>${esc(line.replace(/^#+\s*/,""))}</h2>`);}else if(/^[-*]\s/.test(line)){if(!inList){out.push("<ul>");inList=true;}out.push(`<li>${inline(line.replace(/^[-*]\s/,""))}</li>`);}else if(line.trim()===""){if(inList){out.push("</ul>");inList=false;}}else{if(inList){out.push("</ul>");inList=false;}out.push(`<p>${inline(line)}</p>`);}}if(inList)out.push("</ul>");return out.join("\n");}
import { notFound } from "next/navigation";
export const revalidate = 0;
function SeverityBadge({severity}){if(!severity)return null;return<span className="badge"style={{background:severityColor(severity)}}>{severity.toUpperCase()}</span>;}
export async function generateMetadata({params:pp}){const params=await pp;const supabase=getPublicClient();const{data:article}=await supabase.from("articles").select("title,summary").eq("slug",params.slug).maybeSingle();if(!article)return{title:"Not found — CyberPulse AI"};return{title:`${article.title} — CyberPulse AI`,description:article.summary};}
export default async function ArticlePage({params:pp}){
const params=await pp;
const{data:article}=await getPublicClient().from("articles").select("*").eq("slug",params.slug).maybeSingle();
if(!article)notFound();
try{await getServiceClient().from("articles").update({view_count:(article.view_count||0)+1}).eq("id",article.id);}catch{}
return(<><header className="hdr"><div className="inner"><a href="/"className="logo">CYBER<span>PULSE</span> AI</a><span className="tagline">AI-POWERED THREAT INTELLIGENCE</span></div></header><div className="art"><a href="/"className="back">&#8592; Back to Intelligence Feed</a><div className="art-hdr"><div className="art-meta"><SeverityBadge severity={article.severity}/>{article.category&&<span className="badge-outline">{article.category}</span>}<span>{formatDate(article.published_at)}</span></div><h1>{article.title}</h1><div className="tags"style={{marginTop:"0.45rem"}}>{(article.tags||[]).map((t)=><span key={t}className="tag">{t}</span>)}{(article.cve_ids||[]).map((c)=><span key={c}className="cve">{c}</span>)}</div></div><div className="summary-box">{article.summary}</div><div className="art-body"dangerouslySetInnerHTML={{__html:mdToHtml(article.content||"")}}/>{article.source_urls&&article.source_urls.length>0&&(<div className="sources"><h4>Sources &amp; References</h4><ul>{article.source_urls.map((u)=><li key={u}><a href={u}target="_blank"rel="noopener noreferrer">{u}</a></li>)}</ul></div>)}</div><footer className="ftr">CyberPulse AI — Always verify with primary sources.</footer></>);
}
