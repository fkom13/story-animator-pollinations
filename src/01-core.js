/* Story Animator v0.2 — core. Concatenated into root agent.ts at build. */
const VERSION="0.2.0";
const TIERS={eco:{per5:1,paid:false},medium:{per5:3,paid:false},pro:{per5:5,paid:true}};
const ROLES=["classifier","writer","director","orchestrator","vision","t2i","i2i","tts","stt"];
const EDITORIAL_PRIOR={
 "deepseek/deepseek-v4.1-flash":0.84,"openai/gpt-6.1-terra":0.92,
 "openai/gpt-6-sol":0.96,"openai/gpt-5.4-nano":0.62,
 "z-ai/glm-5.3-flash":0.79,"moonshotai/kimi-k3.1-pro":0.93,
 "typesafe/jev-1.14":0.45,"black-forest-labs/flux.1-schnell":0.51,
 "black-forest-labs/flux.2-klein-4b":0.68,"black-forest-labs/flux.1.1-pro":0.81,
 "black-forest-labs/flux.1-kontext-pro":0.82,"qwen/qwen-image-2.1-turbo":0.87,
 "prunaai/p-image-edit":0.79,"bytedance/seedream-5.0-flash":0.89
};
function rnd(n,p=4){return Number.isFinite(n)?Number(n.toFixed(p)):null}
function txt(x){if(typeof x==="string")return x;if(Array.isArray(x))return x.map(txt).join("\n");return x?.text||x?.content&&txt(x.content)||""}
function getHistory(p){if(Array.isArray(p?.input))return p.input;if(Array.isArray(p?.messages))return p.messages;return typeof p?.input==="string"?[{role:"user",content:p.input}]:[]}
function lastUser(h){return txt([...h].reverse().find(x=>x.role==="user")?.content).trim()}
function hashId(s){let n=2166136261;for(let c of s.slice(0,4000)){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return (n>>>0).toString(16).toUpperCase().padStart(8,"0")}
function encodeState(s){return btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function decodeState(s){try{return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g,"+").replace(/_/g,"/")))))}catch{return null}}
function getState(h){for(let m of [...h].reverse()){if(m.role!=="assistant")continue;let a=txt(m.content).match(/\[\[SA2:([A-Za-z0-9_-]+)\]\]/);if(a){let s=decodeState(a[1]);if(s?.v===2)return s}}return null}
function answer(msg,s,stream=false){
 const body=String(msg)+(s?"\n\n[[SA2:"+encodeState(s)+"]]":"");
 const id="resp_"+crypto.randomUUID();
 const item={id:"msg_"+crypto.randomUUID(),type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:body,annotations:[]}]};
 const obj={id,object:"response",status:"completed",created_at:Math.floor(Date.now()/1000),
  model:"story-animator-pollinations",output:[item],usage:{input_tokens:0,output_tokens:0,total_tokens:0},version:VERSION};
 if(!stream)return Response.json(obj);
 let es="event: response.created\ndata: "+JSON.stringify({type:"response.created",response:{...obj,status:"in_progress",output:[]}})+"\n\n";
 es+="event: response.output_text.delta\ndata: "+JSON.stringify({type:"response.output_text.delta",delta:body})+"\n\n";
 es+="event: response.completed\ndata: "+JSON.stringify({type:"response.completed",response:obj})+"\n\ndata: [DONE]\n\n";
 return new Response(es,{headers:{"Content-Type":"text/event-stream"}});
}
async function api(p,path,opts){
 const r=await p(path,opts||{method:"GET"});
 if(!r?.ok)throw Error(path+": HTTP "+(r?.status||"unknown"));
 return await r.json();
}
function sets(v){return Array.isArray(v)?v.filter(x=>typeof x==="string"):typeof v==="string"?v.split(/[\s,]+/).filter(Boolean):null}
function permission(key,model){
 const allowed=sets(key?.permissions?.models)||sets(key?.models)||sets(key?.allowedModels);
 if(!allowed)return "unverified";
 if(allowed.includes("*")||allowed.includes("all")||allowed.includes(model.id))return "allowed";
 const kind=model.output_modalities?.includes("image")?"image":model.output_modalities?.includes("audio")?"audio":"text";
 return allowed.includes(kind)?"allowed":"denied";
}
function eligible(m,role){
 const i=m.input_modalities||[],o=m.output_modalities||[],e=m.supported_endpoints||[];
 if(role==="classifier"||role==="writer"||role==="director")return o.includes("text")&&e.includes("/v1/chat/completions");
 if(role==="orchestrator")return o.includes("text")&&(m.capabilities||[]).includes("tool_calling");
 if(role==="vision")return o.includes("text")&&i.includes("image");
 if(role==="t2i")return o.includes("image")&&e.includes("/v1/images/generations");
 if(role==="i2i")return i.includes("image")&&o.includes("image")&&e.includes("/v1/images/edits");
 if(role==="tts")return o.includes("audio")&&e.includes("/v1/audio/speech");
 if(role==="stt")return e.includes("/v1/audio/transcriptions");
 return false;
}
function price(m,role){
 const p=m.pricing||{},n=Number(p.completionImageTokens);
 if(role==="t2i"||role==="i2i")return Number.isFinite(n)&&n>=0.0001?n:null;
 if(role==="tts"){const v=Number(p.completionAudioTokens);return Number.isFinite(v)?v*150:null}
 if(role==="stt"){const v=Number(p.promptAudioSeconds);return Number.isFinite(v)?v:null}
 const a=Number(p.promptTextTokens),b=Number(p.completionTextTokens);
 return Number.isFinite(a)&&Number.isFinite(b)?a*3000+b*700:null;
}
function statusMap(data){const map=new Map();for(let x of data?.data||[])if(x.is_rollup===1&&x.model)map.set(x.model,x);return map}
function health(m,stat){
 const h=m.health||{},s=stat.get(m.id);
 const total=Number(s?.total_requests||h.requests||0);
 const reliability=s?Number(s.status_2xx||0)/Math.max(1,total):Number(h.success_rate??70)/100;
 return {up:h.status!=="down",status:h.status||"unknown",success:rnd(reliability,3),
  p50:s?.latency_p50_ms||null,requests:total};
}
const BENCHMAP={
 "openai/gpt-6.1-terra":"gpt-terra-next","openai/gpt-6-sol":"gpt-6-sol",
 "openai/gpt-6-luna":"gpt-6-luna","deepseek/deepseek-v4.1-flash":"deepseek-v4-1-flash",
 "moonshotai/kimi-k3.1-pro":"kimi-k3-1","qwen/qwen3.8-max":"qwen-3-8"
};
async function openBenchmark(){
 const url="https://artificialwatch.com/data/bench-index.json";
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(3200)});
  if(!r.ok)throw Error("HTTP "+r.status);
  const j=await r.json();if(!String(j.license||"").includes("creativecommons.org/licenses/by/4.0"))throw Error("Licence inconnue");
  const indices={};for(const m of j.models||[])if(m.id&&Number.isFinite(Number(m.index)))indices[m.id]=Number(m.index);
  return {indices,date:j.generatedAt||null,source:url,license:"CC BY 4.0"};
 }catch(e){return {indices:{},date:null,source:url,error:String(e.message||e).slice(0,100)}}
}
function scoreModel(m,role,tier,stat,bench){
 const h=health(m,stat),idx=(bench?.indices||{})[BENCHMAP[m.id]],proxy=EDITORIAL_PRIOR[m.id]??0.56;
 const useBench=Number.isFinite(idx)&&["classifier","writer","director","orchestrator","vision"].includes(role);
 const q=useBench?proxy*0.55+(idx/100)*0.45:proxy,p=price(m,role);
 const priceScore=p===null?0.33:Math.max(0,1-Math.log10(1+100*p)/3);
 const weights=tier==="eco"?[0.32,0.42,0.26]:tier==="medium"?[0.54,0.21,0.25]:[0.69,0.07,0.24];
 let score=q*weights[0]+priceScore*weights[1]+h.success*weights[2];
 if(!h.up)score-=2;if(h.status==="degraded")score-=0.13;
 if(role==="classifier"&&m.id.includes("jev"))score+=0.2;
 if(role==="director"&&(m.context_length||0)>100000)score+=0.025;
 if(role==="vision"&&m.input_modalities?.includes("image"))score+=0.03;
 if(["t2i","i2i"].includes(role)&&!Object.prototype.hasOwnProperty.call(EDITORIAL_PRIOR,m.id))score-=0.19;
 if(["t2i","i2i","tts","stt"].includes(role)&&p===null)score-=0.08;
 return rnd(score,5);
}
function rankModels(data,role,tier,key,stats,bench){
 const all=[];
 for(const m of data){
  if(m.community===true||m.id.startsWith("community/"))continue;
  if(!eligible(m,role)||(!TIERS[tier].paid&&m.paid_only!==false)||permission(key,m)==="denied")continue;
  if(m.health?.status==="down")continue;
  const h=health(m,stats);
  all.push({id:m.id,score:scoreModel(m,role,tier,stats,bench),paid:!!m.paid_only,
   price:price(m,role),health:h.status,success:h.success,latency:h.p50,
   keyPermission:permission(key,m),source:"live-pollinations+editorial-prior"+(Number.isFinite((bench?.indices||{})[BENCHMAP[m.id]])?"+ArtificialWatch":"") ,benchIndex:(bench?.indices||{})[BENCHMAP[m.id]]??null});
 }
 all.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 return all.slice(0,12);
}
async function inspect(polli,mcp,tier){
 const paths=["/account/key","/account/balance","/v1/models","/models/status?minutes=60"];
 const all=await Promise.allSettled([...paths.map(u=>api(polli,u)),mcp.listTools("pollinations"),mcp.listTools("ffmpeg"),openBenchmark()]);
 const errors=[],ok=i=>all[i].status==="fulfilled";
 for(let i=0;i<paths.length;i++)if(!ok(i))errors.push(paths[i]+" indisponible");
 const key=ok(0)?all[0].value:null,balance=ok(1)?all[1].value:null;
 const models=ok(2)?all[2].value.data||[]:[],stat=statusMap(ok(3)?all[3].value:null);
 const benchmark=ok(6)?all[6].value:{indices:{},error:"API benchmark inaccessible"};
 const tools={};for(const [i,name] of [[4,"pollinations"],[5,"ffmpeg"]]){
  if(ok(i)){const x=all[i].value;tools[name]=(Array.isArray(x)?x:x?.tools||[]).map(y=>y.name||y.id).filter(Boolean)}
  else{tools[name]=[];errors.push("MCP "+name+" non disponible")}
 }
 const ranks={};for(let r of ROLES)ranks[r]=rankModels(models,r,tier,key,stat,benchmark);
 const can={scenario:ranks.writer.length>0,images:ranks.t2i.length>0&&tools.pollinations.includes("generateImage"),
  edits:ranks.i2i.length>0&&tools.pollinations.includes("generateImage"),
  voice:ranks.tts.length>0&&tools.pollinations.includes("generateAudio"),
  subtitles:ranks.stt.length>0&&tools.pollinations.includes("transcribeAudio"),
  vision:ranks.vision.length>0,ffmpeg:tools.ffmpeg.includes("runFfmpeg")};
 return {key,balance,models,stat,tools,ranks,can,errors,benchmark,
  policy:key?.questPollenOnly===true?"quest-only":key?.questPollenOnly===false?"paid-fallback":"unknown",
  keyBudget:Number.isFinite(Number(balance?.balance))?Number(balance.balance):null,
  walletQuest:typeof balance?.accountBalance?.tier==="number"?balance.accountBalance.tier:null};
}
function modelChoices(ranks){
 return ["classifier","writer","director","vision","t2i","i2i","tts","stt"].map(k=>{
  let a=ranks[k]||[];return k+": "+(a.length?a.slice(0,2).map((v,j)=>(j?"fallback ":"principal ")+v.id+(v.paid?" [Paid]":" [Quest-compatible]")+" score="+v.score+(v.benchIndex!==null?" indice indépendant="+v.benchIndex:"")+" "+v.health).join(" / "):"aucun modèle autorisé");
 }).join("\n");
}
function diagnosis(x,tier,full=false){
 let out="🔎 Diagnostic de la clé de CET utilisateur (aucune clé envoyée au créateur) :\n";
 out+="Capacités : "+Object.entries(x.can).map(([k,v])=>k+"="+(v?"oui":"non")).join(", ")+"\n";
 if(!x.can.voice)out+="⚠ Narration/dialogues audio indisponibles avec cette clé : il faut ajuster les droits modèles/audio ou choisir sans voix.\n";
 if(!x.can.images)out+="⚠ Images indisponibles avec cette clé, production impossible.\n";
 if(tier!=="pro"&&x.policy!=="quest-only")out+="⚠ Quest-only non garanti par la clé : une clé sans questPollenOnly peut utiliser Paid après épuisement du Quest. Eco/Medium peuvent préparer un scénario, mais le rendu strict sera bloqué.\n";
 if(tier==="pro"&&x.policy==="quest-only")out+="⚠ La clé interdit Paid : le mode Pro pourra être restreint.\n";
 out+="Budget de clé : "+(x.keyBudget===null?"inconnu":rnd(x.keyBudget)+" Pollen")+
  " ; catalogue : "+x.models.length+" modèles ; métriques 60 min : "+x.stat.size+".\n";
 if(x.errors.length)out+="Données non vérifiables : "+x.errors.join(" ; ")+"\n";
 if(full)out+="\nClassement dynamique (principal / fallback) :\n"+modelChoices(x.ranks)+"\n";
 out+="Score = capacités, prix catalogue, santé récente et prior artistique. Benchmark LLM indépendant : ArtificialWatch Bench Index CC BY 4.0 ("+(x.benchmark?.date||"indisponible")+") : https://artificialwatch.com/benchmarks. Correspondance explicite des modèles seulement ; cet indice ne mesure pas la qualité T2I/TTS.";
 return out;
}
