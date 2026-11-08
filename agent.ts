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

/* Story Animator v0.2 — creative decision, storyboard and estimates. */
function parseJson(x){
 if(x && typeof x==="object")return x;
 if(typeof x!=="string")return null;
 let t=x.trim();
 try{return JSON.parse(t)}catch{}
 let a=t.indexOf("{"),b=t.lastIndexOf("}");if(a>=0&&b>a){try{return JSON.parse(t.slice(a,b+1))}catch{}}
 return null;
}
async function generateJson(polli,model,system,user,maxTokens=3300){
 let args={model,stream:false,max_tokens:maxTokens,temperature:0.6,
  messages:[{role:"system",content:system},{role:"user",content:user}]};
 const out=await api(polli,"/v1/chat/completions",{
  method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(args)});
 const c=out.choices?.[0]?.message?.content;
 const parsed=parseJson(txt(c));
 if(!parsed)throw Error("Réponse narrative non structurée de "+model);
 return parsed;
}
function detectBrief(input){
 const mins=input.match(/\b(\d{1,2})\s*(?:minutes?|min)\b/i);
 const secs=input.match(/\b(\d{1,4})\s*(?:secondes?|sec|s)\b/i);
 const duration=mins?Number(mins[1])*60:secs?Number(secs[1]):30;
 const tier=/\bpro\b/i.test(input)?"pro":/\bm[ée]dium\b/i.test(input)?"medium":"eco";
 const aspect=/9[:\/]16|vertical/i.test(input)?"9:16":/1[:\/]1|carr[ée]/i.test(input)?"1:1":"16:9";
 return {idea:input.slice(0,3000),duration,tier,aspect,
  voice:!/\bsans voix\b|\bsans narration\b/i.test(input),
  subtitles:!/\bsans sous.?titres?\b/i.test(input),
  style:/photor[ée]al|cin[ée]ma/i.test(input)?"photorealistic cinematic":/anime|manga/i.test(input)?"anime":/cartoon/i.test(input)?"cartoon":"adapted to story",
  pace:/action|rapide|combat|street|clip/i.test(input)?0.78:0.5};
}
async function classify(polli,x,brief){
 let preferred=x.ranks.classifier||[];
 // JEV is selected only when the caller's key and chosen policy permit Paid.
 let preferredJev=preferred.find(m=>m.id.includes("jev")&&m.paid===true);
 const chosen=(brief.tier==="pro"&&preferredJev)||preferred.find(m=>!m.paid)||preferred[0];
 if(!chosen)return {genre:"fiction",energy:brief.pace,imageStyle:brief.style,detail:"Classification locale",model:null};
 try{
  let obj=await generateJson(polli,chosen.id,
   'Classificateur de production audiovisuelle. Fournis UNIQUEMENT un JSON avec: {"genre":"...", "energy":0.5, "imageStyle":"...", "narrativeComplexity":"low|medium|high", "visionCritical":true, "dialogue":true, "notes":"..."}. Aucun commentaire. Identifie la forme narrative, le ton, le besoin de cohérence des personnages et le rythme. Pas de recommandation de modèle sans catalogue.',
   brief.idea,350);
  return {genre:String(obj.genre||"fiction").slice(0,60),
   energy:Math.max(0,Math.min(1,Number(obj.energy)||brief.pace)),
   imageStyle:String(obj.imageStyle||brief.style).slice(0,90),
   narrativeComplexity:String(obj.narrativeComplexity||"medium").slice(0,30),
   visionCritical:obj.visionCritical!==false,dialogue:obj.dialogue===true,
   detail:String(obj.notes||"").slice(0,240),model:chosen.id};
 }catch(e){return {genre:"fiction",energy:brief.pace,imageStyle:brief.style,
  detail:"Classificateur non disponible; heuristique utilisée : "+e.message.slice(0,90),model:chosen.id}}
}
function normalizeScript(a,brief){
 const beats=(Array.isArray(a.beats)?a.beats:[]).slice(0,Math.min(24,Math.ceil(brief.duration/2))).map((b,i)=>({
  title:String(b.title||"Moment "+(i+1)).slice(0,120),
  visual:String(b.visual||brief.idea).slice(0,550),
  spoken:String(b.spoken||b.speech||"").slice(0,500),
  intensity:Math.max(0,Math.min(1,Number(b.intensity)||0.5)),
  camera:String(b.camera||"cinematic").slice(0,45)
 }));
 if(!beats.length)beats.push({title:"Plan d'introduction",visual:brief.idea,spoken:"",intensity:0.5,camera:"dolly"});
 const voiceover=String(a.voiceover||beats.map(b=>b.spoken).join(" ")).slice(0,12000);
 return {title:String(a.title||"Story Animator").slice(0,110),
  synopsis:String(a.synopsis||brief.idea).slice(0,1000),
  visualBible:String(a.visualBible||a.world||"").slice(0,1200),
  characters:Array.isArray(a.characters)?a.characters.slice(0,6).map(c=>String(c).slice(0,250)):[],
  beats,voiceover,direction:String(a.direction||"").slice(0,1200),
  duration:brief.duration};
}
async function writeScenario(polli,x,brief,classification){
 const candidates=(x.ranks.writer||[]).slice(0,2);if(!candidates.length)throw Error("Aucun scénariste autorisé par cette clé");
 const maxWords=Math.round(brief.duration*1.75);
 const prompt="Tu écris une histoire complète, originale, mise en scène, avec vrai arc dramatique, progression, dialogues/voix off, chute ou résolution. Durée cible: "+brief.duration+" secondes ; budget maximum de "+maxWords+" mots PRONONCÉS. Style "+brief.style+". Rythme "+classification.energy+" ; "+classification.imageStyle+". L'univers doit être cohérent et les personnages décrits assez précisément pour plusieurs images. Il faut des beats d'intensité variable et des compositions différentes. Une scène peut durer 1 à 20 secondes ; les images qui la représentent peuvent changer plus vite. Une narration n'est PAS un dialogue si les personnages ne parlent pas. Montage de photos animées uniquement (sans I2V). Réponds STRICTEMENT par JSON: {title,synopsis,visualBible,characters:[string],beats:[{title,visual,spoken,intensity,camera}],voiceover,direction}. Aucun texte hors JSON.";
 const errors=[];
 for(const m of candidates){
  try{
   const result=await generateJson(polli,m.id,prompt,"IDÉE: "+brief.idea+"\nCLASSIFICATION: "+JSON.stringify(classification),5800);
   return normalizeScript(result,brief);
  }catch(e){errors.push(m.id+" : "+String(e.message||e).slice(0,90))}
 }
 throw Error("Scénariste principal et fallback indisponibles : "+errors.join("; "));
}
function shotPlan(script,brief,classification){
 const seconds=brief.duration,blocks=Math.ceil(seconds/5),tier=TIERS[brief.tier],shots=[];
 const motions=["push-in","pan-left","pull-back","diagonal","tilt-up","micro-cut","pan-right","slow-hold"];
 let index=0;
 for(let slot=0;slot<blocks;slot++){
  const st=slot*5,total=Math.min(5,seconds-st);
  const beat=script.beats[Math.min(script.beats.length-1,Math.floor(st/seconds*script.beats.length))];
  const intensity=.65*beat.intensity+.35*classification.energy;
  const n=brief.tier==="eco"?1:brief.tier==="medium"?(intensity<.3?1:intensity<.7?2:3):(intensity<.3?2:intensity<.7?3:5);
  for(let j=0;j<n;j++){
   const dt=total/n,phase=j/n;
   const prompt=[beat.visual,script.visualBible,script.characters.join("; "),
    "photographic composition for beat "+beat.title,"frame "+(j+1)+"/"+n,
    "visual storytelling; camera angle "+motions[(index+slot*3+j)%motions.length],
    "subshot progression "+phase.toFixed(2),"aspect "+brief.aspect].join("; ").slice(0,1500);
   shots.push({n:index++,start:rnd(st+j*dt,3),duration:rnd(dt,3),
    intensity:rnd(intensity,2),motion:motions[(index+slot*3+j)%motions.length],
    prompt,spoken:beat.spoken.slice(0,160)});
  }
 }
 return shots;
}
function billEstimate(brief,x,shots){
 const counts={classifier:1,writer:1,director:1,vision:shots.length?1:0,
  t2i:shots.length,i2i:Math.ceil(shots.length*(brief.tier==="pro"?.25:brief.tier==="medium"?.12:.03)),
  tts:brief.voice?1:0,stt:brief.voice&&brief.subtitles?1:0};
 let quest=0,paid=0,uncertain=[];
 for(let [role,qty] of Object.entries(counts)){
  const m=x.ranks[role]?.[0];if(!m){uncertain.push(role+" absent");continue}
  if(m.price===null){uncertain.push(role+" : tarif unitaire non déterminable");continue}
  let c=role==="tts"?m.price*(brief.duration/10):role==="stt"?m.price*brief.duration:m.price*qty;
  if(m.paid)paid+=c;else quest+=c;
 }
 quest+=0.00000778*Math.max(20,brief.duration*2);
 return {quest:[rnd(quest*0.75,5),rnd(quest*2.3+0.002,5)],
  paid:[rnd(paid*0.75,5),rnd(paid*2.3+0.002,5)],
  uncertain,note:"Fourchettes indicatives sans garantie : durée calcul FFmpeg, taille images, tokens audio, retries et permissions varient."};
}
function planText(st,x){
 const b=st.brief,s=st.script,c=billEstimate(b,x,st.shots);
 return "🎬 "+s.title+"\n\n"+s.synopsis+
  "\n\nDirection artistique : "+s.direction+"\nBible visuelle : "+s.visualBible+
  "\n\nSéquences :\n"+s.beats.map((v,i)=>(i+1)+". "+v.title+" — "+v.visual+" (intensité "+v.intensity+")").join("\n")+
  "\n\nVoix off proposée : "+s.voiceover+
  "\n\nDécoupage pour "+b.duration+" s : "+st.shots.length+" images, plafond "+TIERS[b.tier].per5+" images/5s, rythme libre selon l'action.\n"+
  "Voix : "+(b.voice?"oui":"non")+" ; sous-titres : "+(b.subtitles?"demandés":"non")+" ; format : "+b.aspect+".\n"+
  "Coût estimé : Quest "+c.quest.join(" à ")+" Pollen, Paid "+c.paid.join(" à ")+" Pollen"+
  (c.uncertain.length?"; à préciser : "+c.uncertain.join(", "):"")+
  ".\n\nClassement des modèles réévalué à cette étape :\n"+modelChoices(x.ranks)+
  "\n\nValide le scénario avec VALIDER SCRIPT "+st.id+", ou demande une réécriture.";
}

/* Story Animator v0.2 — media executor. All MCP calls on the caller's delegation. */
function mediaUrl(res){
 const c=res?.content||res?.result?.content||[];
 for(const item of c){
  if(typeof item.uri==="string"&&/^https:\/\//.test(item.uri))return item.uri;
  if(item.type==="text"){const j=parseJson(item.text);if(j?.url)return j.url}
 }
 return res?.url||null;
}
function validMedia(u){return typeof u==="string"&&/^https:\/\/media\.pollinations\.ai\/[0-9a-z-]+$/i.test(u)}
async function toolCall(mcp,server,name,args){
 const res=await mcp(server,name,args);
 if(res?.isError||res?.result?.isError)throw Error(txt(res?.content)||"Erreur du MCP "+name);
 const u=mediaUrl(res);
 if(!validMedia(u))throw Error("URL média manquante ou non vérifiée pour "+name);
 return u;
}
async function reviewFirstImage(polli,visionId,u,prompt){
 if(!visionId)return {score:null,note:"Pas de modèle vision accessible."};
 try{
  const payload={model:visionId,stream:false,max_tokens:550,temperature:0.1,
   messages:[{role:"system",content:"Contrôleur de qualité visuel. REGARDE effectivement l'image transmise. JSON uniquement: {score:0.0,composition:0.0,characters:0.0,issues:[string],suggestion:string}. Note sévèrement respect du brief, cohérence des personnages, cadrage, style. Si l'image est inaccessible, score null."},
    {role:"user",content:[{type:"text",text:"Image de référence du film. Le brief : "+prompt.slice(0,1200)},
     {type:"image_url",image_url:{url:u}}]}]};
  const data=await api(polli,"/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const result=parseJson(txt(data.choices?.[0]?.message?.content));
  if(result&&typeof result.score==="number")return {
   score:Math.max(0,Math.min(1,result.score)),issues:result.issues||[],
   suggestion:String(result.suggestion||"").slice(0,280),model:visionId};
  return {score:null,note:"Le modèle vision n'a pas retourné une analyse vérifiable."};
 }catch(e){return {score:null,note:"Analyse visuelle non disponible : "+String(e.message||e).slice(0,120)}}
}
async function generateImages(st,x,mcp,polli){
 const messages=[],take=Math.min(4,st.shots.length-st.images.length);
 for(let i=0;i<take;i++){
  const shot=st.shots[st.images.length];
  let u=null,modelName=null;
  for(const cand of (x.ranks.t2i||[]).slice(0,2)){
   try{
    u=await toolCall(mcp,"pollinations","generateImage",{model:cand.id,prompt:shot.prompt,
      size:st.brief.aspect==="9:16"?"720x1280":"1280x720"});
    modelName=cand.id;break;
   }catch(e){messages.push("Image "+shot.n+", "+cand.id+" : "+String(e.message||e).slice(0,100))}
  }
  if(!u){messages.push("Lot interrompu : modèle image principal et fallback indisponibles.");break}
  st.images.push({n:shot.n,url:u,model:modelName});
  if(st.images.length===1){
   st.review=await reviewFirstImage(polli,x.ranks.vision?.[0]?.id,u,shot.prompt);
   messages.push("Contrôle de la 1ère image : "+(st.review.score===null?st.review.note:
     "score "+st.review.score+" ; "+(st.review.issues||[]).join("; ")));
   if(st.review.score!==null&&st.review.score<0.5){
    st.step="qc";messages.push("Image initiale rejetée par le contrôle artistique ; fournir AJUSTER IMAGE avant de poursuivre.");
    break;
   }
  }
 }
 if(st.step!=="qc")st.step=st.images.length===st.shots.length?"render":"images";
 return messages;
}
function shotPreset(shots,urls,aspect){
 if(!shots.length||shots.length>4||shots.length!==urls.length)throw Error("Montage limité à 4 images par segment.");
 const w=aspect==="9:16"?360:aspect==="1:1"?480:640;
 const h=aspect==="9:16"?640:aspect==="1:1"?480:360;
 const parts=[],args=[];
 for(let i=0;i<shots.length;i++){
  const shot=shots[i],sec=Math.max(.16,shot.duration),frames=Math.max(2,Math.round(sec*25));
  args.push("-loop","1","-framerate","25","-t",String(rnd(sec,3)),"-i","input"+i);
  const axis=(shot.motion==="pan-left"||shot.motion==="pan-right"||shot.motion==="micro-cut")?
   "(iw-iw/zoom)*on/"+(frames-1):"(iw-iw/zoom)/2";
  const rev=shot.motion==="pull-back";
  const zoom=rev?"1.16-0.12*on/"+(frames-1):"1+0.15*on/"+(frames-1);
  const stem="["+i+":v]scale="+(w+120)+":"+(h+90)+
   ":force_original_aspect_ratio=increase,crop="+(w+120)+":"+(h+90)+
   ",zoompan=z='"+zoom+"':x='"+axis+"':y='(ih-ih/zoom)/2'"+
   ":d=1:fps=25:s="+w+"x"+h+"[v"+i+"]";
  parts.push(stem);
 }
 const filter=parts.join(";")+";"+shots.map((_,i)=>"[v"+i+"]").join("")+
   "concat=n="+shots.length+":v=1:a=0,format=yuv420p[v]";
 args.push("-filter_complex",filter,"-map","[v]","-r","25","-c:v","libx264",
   "-preset","veryfast","-crf","25","-pix_fmt","yuv420p","-movflags","+faststart");
 if(args.length>64||filter.length>1024)throw Error("Limites MCP FFmpeg atteintes, découper plus finement.");
 return {sources:urls,args,outputExtension:"mp4"};
}
async function renderClip(st,mcp){
 const chunks=[];for(let i=0;i<st.shots.length;i+=4)chunks.push(st.shots.slice(i,i+4));
 const i=st.clips.length;
 if(i>=chunks.length){st.step="final";return "Clips déjà produits."}
 const group=chunks[i],urls=group.map(s=>st.images.find(a=>a.n===s.n)?.url);
 if(urls.some(u=>!u))throw Error("Image absente dans le groupe "+i);
 const u=await toolCall(mcp,"ffmpeg","runFfmpeg",shotPreset(group,urls,st.brief.aspect));
 st.clips.push(u);st.step=st.clips.length===chunks.length?"final":"render";
 return "Clip "+st.clips.length+"/"+chunks.length+" créé : "+u;
}
function subtitleFilter(script,duration){
 // Subtitles based on approved narration text; approximate timing, explicitly disclosed.
 const beats=script.beats.slice(0,8);
 if(!beats.length)return "";
 const chunk=duration/beats.length,parts=[];
 for(let i=0;i<beats.length;i++){
  const s=String(beats[i].spoken||"").replace(/[\\':%,;[\]]/g," ").replace(/[\n\r]/g," ").slice(0,62);
  if(!s)continue;
  parts.push("drawtext=text='"+s+"':fontsize=19:fontcolor=white:box=1:boxcolor=black@0.6"+
   ":x=(w-text_w)/2:y=h-48:enable='between(t,"+rnd(i*chunk,2)+","+rnd((i+1)*chunk,2)+")'");
 }
 return parts.join(",");
}
function finalPreset(clips,audio,seconds,script,subtitles){
 const sources=audio?[...clips,audio]:clips.slice();
 if(sources.length>25)throw Error("Plus de 25 clips : sous-montage requis.");
 const args=[];for(let i=0;i<sources.length;i++)args.push("-i","input"+i);
 const st=clips.map((_,i)=>"["+i+":v]").join("");
 let filter=st+"concat=n="+clips.length+":v=1:a=0,format=yuv420p[v0]";
 const cap=subtitles?subtitleFilter(script,seconds):"";
 if(cap&&filter.length+cap.length+10<=1024)filter+=";[v0]"+cap+"[v]";
 else filter+=";[v0]null[v]";
 if(audio)filter+=";["+clips.length+":a]apad,atrim=duration="+rnd(seconds,3)+"[a]";
 args.push("-filter_complex",filter,"-map","[v]");
 if(audio)args.push("-map","[a]");
 args.push("-t",String(rnd(seconds,3)),"-c:v","libx264","-preset","veryfast",
   "-crf","25","-pix_fmt","yuv420p");
 if(audio)args.push("-c:a","aac","-b:a","96k");
 args.push("-movflags","+faststart");
 if(args.length>64||filter.length>1024)throw Error("Limites FFmpeg pour ce montage; sous-montage requis.");
 return {sources,args,outputExtension:"mp4",captionsIncluded:!!cap&&filter.includes("drawtext")};
}
async function finalize(st,x,mcp){
 let notes=[];
 if(st.brief.voice&&!st.voiceUrl){
  for(const m of (x.ranks.tts||[]).slice(0,2)){
   try{
    st.voiceUrl=await toolCall(mcp,"pollinations","generateAudio",{
      model:m.id,text:st.script.voiceover,voice:m.id.includes("mai-voice")?"fr-FR-Harper":"alloy",response_format:"mp3"});
    break;
   }catch(e){notes.push("Voix "+m.id+" : "+String(e.message||e).slice(0,100))}
  }
 }
 if(st.brief.voice&&!st.voiceUrl)return {done:false,notes:[...notes,"Voix indisponible. On conserve tous les médias déjà payés."]};
 const preset=finalPreset(st.clips,st.voiceUrl,st.brief.duration,st.script,st.brief.subtitles);
 try{
  st.finalUrl=await toolCall(mcp,"ffmpeg","runFfmpeg",{
    sources:preset.sources,args:preset.args,outputExtension:preset.outputExtension});
  st.step="done";
  notes.push("MP4 final produit : "+st.finalUrl);
  if(st.brief.subtitles&&!preset.captionsIncluded)notes.push("⚠ Sous-titres non incrustés : limite de taille de la commande; SRT export requis.");
  if(st.brief.subtitles&&preset.captionsIncluded)notes.push("Sous-titres estimés et incrustés; les timings ne sont pas des timings d'alignement vocal certifiés.");
  notes.push("Ne déclarer le film validé qu'après lecture/inspection du média.");
  return {done:true,notes};
 }catch(e){return {done:false,notes:[...notes,"FFmpeg final en erreur : "+String(e.message||e).slice(0,200)]}}
}

/* Story Animator v0.2 — conversation state machine, user-key-first onboarding. */
function cmdId(input,name){
 const m=input.match(new RegExp("^"+name+"\\s+([0-9A-F]{8})\\s*$","i"));
 return m?.[1]?.toUpperCase()||null;
}
function summary(st){
 return "Projet "+st.id+" — "+(st.script?.title||st.brief.idea.slice(0,70))+
  " ; "+st.brief.duration+" s / "+st.brief.tier.toUpperCase()+
  " ; images "+(st.images?.length||0)+"/"+(st.shots?.length||0)+
  " ; segments montés "+(st.clips?.length||0)+".";
}
function blockers(st,x){
 const issues=[];
 if(!x.key)issues.push("Impossible de vérifier les droits de la clé du demandeur ; production suspendue.");
 if(!x.can.images)issues.push("Aucun modèle image T2I autorisé avec cette clé.");
 if(!x.can.ffmpeg)issues.push("MCP FFmpeg indisponible avec les droits courants.");
 if(st.brief.voice&&!x.can.voice)issues.push("Aucun modèle de voix autorisé : la narration et les dialogues audio ne pourront pas être générés.");
 if(st.brief.tier!=="pro"&&x.policy!=="quest-only")
  issues.push("Eco/Medium strictement Quest : cette clé ne prouve pas questPollenOnly. L'utilisateur doit restreindre sa clé, pas la communiquer.");
 if(st.brief.tier==="pro"&&x.policy==="quest-only")
  issues.push("Clé configurée Quest-only : accès aux modèles Paid du mode Pro limité.");
 if(x.keyBudget!==null&&x.keyBudget<=0)issues.push("Budget de clé épuisé.");
 return issues;
}
function presentApproved(st,x){
 const e=billEstimate(st.brief,x,st.shots);
 const problems=blockers(st,x);
 return summary(st)+"\n\nScénario validé, plan de production : "+st.shots.length+" images, "+
  Math.ceil(st.shots.length/4)+" lots de génération, "+
  Math.ceil(st.shots.length/4)+" montages partiels puis assemblage final.\n"+
  "Montage adaptatif : "+TIERS[st.brief.tier].per5+" images/5 s au maximum, plans plus courts aux moments intenses.\n"+
  "Budget approximatif : Quest "+e.quest.join(" à ")+" ; Paid "+e.paid.join(" à ")+
  " Pollen. Ce sont des ESTIMATIONS, pas des plafonds ou une autorisation de recharge.\n"+
  (problems.length?"⚠ Blocages réels avant production :\n- "+problems.join("\n- "):
  "Précontrôle des catégories sans blocage connu. Les permissions restent contrôlées à chaque appel.")+
  "\n\nPour lancer : VALIDER PRODUCTION "+st.id+". Les appels seront fractionnés : CONTINUER entre les lots et les montages.";
}
function applyModelChoices(x,st){
 for(const [role,choice] of Object.entries(st?.modelOverrides||{})){
  if(!ROLES.includes(role))continue;
  const available=x.ranks[role]||[];
  const candidates=[choice.primary,choice.fallback].filter(Boolean);
  for(let i=candidates.length-1;i>=0;i--){
   const idx=available.findIndex(m=>m.id===candidates[i]);
   if(idx>=0)available.unshift(available.splice(idx,1)[0]);
  }
 }
 return x;
}
function manuallyAllowed(x,tier,role,id){
 const m=x.models.find(v=>v.id===id);
 if(!m||!ROLES.includes(role)||!eligible(m,role))return {ok:false,reason:"Modèle absent du catalogue ou non compatible avec cette catégorie."};
 if(tier!=="pro"&&m.paid_only!==false)return {ok:false,reason:"Modèle Paid interdit en ECO/MEDIUM."};
 if(permission(x.key,m)==="denied")return {ok:false,reason:"Restriction de clé : modèle interdit."};
 if(m.health?.status==="down")return {ok:false,reason:"Modèle actuellement hors service."};
 return {ok:true,model:{id,score:scoreModel(m,role,tier,x.stat,x.benchmark),
  paid:!!m.paid_only,price:price(m,role),health:m.health?.status||"unknown",
  keyPermission:permission(x.key,m)}};
}
function shortenState(st){
 // Protect the user's display and token count while preserving resumability.
 return st;
}
export default async function agent({model,respond,mcp,pollinations,request}){
 let payload;
 try{payload=await request.clone().json()}catch{return answer("JSON invalide.")}
 const history=getHistory(payload),msg=lastUser(history).slice(0,7000);
 const send=(message,st)=>answer(message,st?shortenState(st):null,!!payload?.stream);
 let st=getState(history);
 let tier=st?.brief?.tier||detectBrief(msg).tier;
 if(!TIERS[tier])tier="eco";
 let x=applyModelChoices(await inspect(pollinations,mcp,tier),st);
 if(!msg||/^(VERIFIER|VÉRIFIER|DIAGNOSTIC|CHECK)$/i.test(msg)){
  return send(diagnosis(x,tier,true)+
   "\n\nPropose une idée d'histoire, ton style et si tu souhaites une narration. Je proposerai 15, 30 et 60 secondes, mais tu peux demander une durée personnalisée.");
 }
 const selectedModel=msg.match(/^(MODELE|FALLBACK)\s+([a-z]+)\s+([A-Za-z0-9/._:-]+)$/i);
 if(selectedModel&&st){
  const action=selectedModel[1].toUpperCase(),role=selectedModel[2].toLowerCase(),id=selectedModel[3];
  const found=manuallyAllowed(x,st.brief.tier,role,id);
  if(!found.ok)return send("Choix refusé : "+found.reason+"\nClassement disponible :\n"+modelChoices(x.ranks),st);
  const overrides={...(st.modelOverrides||{})},entry={...(overrides[role]||{})};
  entry[action==="MODELE"?"primary":"fallback"]=id;overrides[role]=entry;
  st={...st,modelOverrides:overrides};
  x=applyModelChoices(x,st);
  return send("Choix "+action+" enregistré pour "+role+": "+id+" ; validation recontrôlée avant toute génération.\n"+modelChoices(x.ranks)+
    "\nPour ton scénario : SCENARIO "+st.brief.duration+" "+st.brief.tier.toUpperCase()+".",st);
 }
 if(/^MODE\s+(ECO|MEDIUM|PRO)$/i.test(msg)&&st){
  const newTier=msg.match(/^MODE\s+(ECO|MEDIUM|PRO)$/i)[1].toLowerCase();
  if(["images","render","final","done"].includes(st.step))return send("Production déjà engagée : changer de mode invaliderait les médias facturés. Termine ou crée un nouveau projet.",st);
  const b={...st.brief,tier:newTier};x=applyModelChoices(await inspect(pollinations,mcp,newTier),st);
  st={...st,brief:b};
  if(st.script){st.shots=shotPlan(st.script,b,st.classification);st.step="script";st.images=[];st.clips=[];st.voiceUrl=null;st.finalUrl=null}
  return send(diagnosis(x,newTier,true)+
   (st.script?"\n\n"+planText(st,x):"\nRéponds SCENARIO "+b.duration+" "+newTier.toUpperCase()+" pour continuer."),st);
 }
 const launch=msg.match(/^SCENARIO\s+(\d{1,6})(?:\s+(ECO|MEDIUM|PRO))?$/i);
 if(launch){
  let seconds=Number(launch[1]),mode=(launch[2]||st?.brief?.tier||"eco").toLowerCase();
  if(!TIERS[mode])mode="eco";
  if(seconds<5||seconds>3600)return send("La durée demandée doit être entre 5 et 3600 secondes pour éviter un projet inexécutable en une conversation. Au-delà, la production doit être subdivisée en épisodes.");
  const pastIdea=history.filter(m=>m.role==="user").map(m=>txt(m.content)).filter(s=>!/^(SCENARIO|VALIDER|CONTINUER|MODE)/i.test(s)).join(" ");
  const base=st?.brief||detectBrief(pastIdea||msg);
  const b={...base,duration:seconds,tier:mode};
  x=applyModelChoices(await inspect(pollinations,mcp,mode),st);
  if(!x.can.scenario)return send(diagnosis(x,mode,true)+"\nImpossible de construire un scénario avec cette clé.");
  const classification=await classify(pollinations,x,b);
  let script;
  try{
   script=await writeScenario(pollinations,x,b,classification);
   if(mode!=="eco"&&x.ranks.director?.length){
    try{
     const revision=await generateJson(pollinations,x.ranks.director[0].id,
      'Tu es réalisateur et script doctor. Améliore la dramaturgie, la direction artistique et le raccord visuel de ce plan. Vérifie cohérence personnages et variété cadrages, montée en tension, climax, durée. Réponds UNIQUEMENT avec JSON du même schéma: title,synopsis,visualBible,characters:[string],beats:[{title,visual,spoken,intensity,camera}],voiceover,direction. Ne pas dépasser la durée ni accroître les dialogues au-delà de 2 mots/s.',
      JSON.stringify(script),3400);
     script=normalizeScript(revision,b);
    }catch(e){classification.detail+=" ; révision réalisateur indisponible : "+String(e.message||e).slice(0,90)}
   }
  }catch(e){return send("Création du scénario indisponible : "+String(e.message||e).slice(0,240)+"\nLe catalogue et l'onboarding restent accessibles.",st)}
  st={v:2,id:hashId(b.idea+"|"+seconds+"|"+mode),step:"script",modelOverrides:st?.modelOverrides||{},
   brief:b,classification,script,shots:shotPlan(script,b,classification),
   images:[],clips:[],voiceUrl:null,finalUrl:null,review:null};
  return send(diagnosis(x,mode,false)+"\n\n"+planText(st,x),st);
 }
 if(/^SANS VOIX$/i.test(msg)&&st){
  if(["images","render","final","done"].includes(st.step))return send("La production est engagée ; pour changer de voix, il faut créer une nouvelle version.",st);
  const b={...st.brief,voice:false};st={...st,brief:b};
  return send("Narration désactivée. "+(st.script?planText(st,x):"Tu peux poursuivre le scénario."),st);
 }
 if(/^SANS SOUS.TITRES?$/i.test(msg)&&st){
  const b={...st.brief,subtitles:false};st={...st,brief:b};
  return send("Sous-titres désactivés.",st);
 }
 const validateScript=cmdId(msg,"VALIDER SCRIPT");
 if(validateScript){
  if(!st?.script||st.id!==validateScript)return send("Scénario introuvable ou identifiant incorrect. Réaffiche la proposition initiale.");
  st={...st,step:"approved"};
  return send(presentApproved(st,x),st);
 }
 const produce=cmdId(msg,"VALIDER PRODUCTION");
 const resume=/^(CONTINUER|REPRENDRE)(?:\s+[0-9A-F]{8})?$/i.test(msg);
 if(produce||resume){
  if(!st?.script||!st?.shots?.length)return send("Aucun projet validé dans cet historique.");
  if(produce && st.id!==produce)return send("Identifiant de projet incorrect, aucune opération payante lancée.",st);
  if(produce && st.step!=="approved")return send("Validation du scénario nécessaire : VALIDER SCRIPT "+st.id+".",st);
  if(!produce && !["images","qc","render","final"].includes(st.step))return send("Étape non reprenable actuellement : "+summary(st),st);
  const errors=blockers(st,x);if(errors.length)return send("Production arrêtée AVANT la prochaine génération :\n- "+errors.join("\n- ")+
   "\n\n"+diagnosis(x,st.brief.tier,true)+"\nLes résultats déjà produits restent réutilisables.",st);
  st={...st,images:(st.images||[]).slice(),clips:(st.clips||[]).slice()};
  let notes=[];
  try{
   if(produce||st.step==="images"){
    st.step="images";notes=await generateImages(st,x,mcp,pollinations);
   }else if(st.step==="qc"){
    return send("Première image signalée non conforme par le contrôleur visuel. Réponds ACCEPTER IMAGE "+st.id+" pour la garder, ou REFAIRE IMAGE "+st.id+" pour solliciter le fallback.",st);
   }else if(st.step==="render")notes=[await renderClip(st,mcp)];
   else{
    const fin=await finalize(st,x,mcp);notes=fin.notes;
   }
  }catch(e){notes=["Étape impossible : "+String(e.message||e).slice(0,280), "Les images et clips déjà payés sont conservés."]}
  return send(summary(st)+"\n"+notes.join("\n")+
   (st.step==="done"?"\n\nMontage produit : "+st.finalUrl+". Vérifie visuellement la lecture réelle, la durée et le son.":
    "\n\nRéponds CONTINUER pour avancer d'un lot, sans régénérer les médias déjà faits."),st);
 }
 const accept=cmdId(msg,"ACCEPTER IMAGE");
 if(accept&&st?.id===accept&&st.step==="qc"){
  st={...st,step:"images"};
  return send("Image initiale acceptée malgré l'alerte. Réponds CONTINUER.",st);
 }
 const redo=cmdId(msg,"REFAIRE IMAGE");
 if(redo&&st?.id===redo&&st.step==="qc"){
  st={...st,step:"images",images:st.images.slice(1),review:null};
  return send("La première image est mise de côté ; une nouvelle génération sera demandée au prochain CONTINUER. La dépense précédente n'est pas récupérable.",st);
 }
 if(st){
  if(/^MODIFIER|^REFAIRE|^SCRIPT/i.test(msg))return send("Décris les corrections à intégrer puis utilise SCENARIO "+st.brief.duration+" "+st.brief.tier.toUpperCase()+".",st);
  return send(summary(st)+"\n\n"+diagnosis(x,st.brief.tier,true)+
   "\n\nCommandes : SCENARIO "+st.brief.duration+" "+st.brief.tier.toUpperCase()+
   " ; VALIDER SCRIPT "+st.id+" ; MODE ECO|MEDIUM|PRO ; MODELE t2i fournisseur/modèle ; FALLBACK t2i fournisseur/modèle ; CONTINUER selon l'étape.",st);
 }
 const brief=detectBrief(msg);x=await inspect(pollinations,mcp,brief.tier);
 const classification=await classify(pollinations,x,brief);
 const roughSlots=Math.ceil(brief.duration/5)*TIERS[brief.tier].per5;
 const estimate=billEstimate(brief,x,new Array(roughSlots).fill({}));
 st={v:2,id:hashId(msg),step:"onboard",brief,classification};
 return send(diagnosis(x,brief.tier,true)+
  "\n\n🎬 TON HISTOIRE\n"+brief.idea+
  "\nClassification : "+classification.genre+" / "+classification.imageStyle+
  " ; intensité="+classification.energy+" ; modèle décisionnel="+(classification.model||"heuristique")+".\n"+
  "Je propose 15, 30 ou 60 secondes, ou une durée personnalisée. Trois modes : "+
  "ECO (Quest-only, au plus 1 image/5 s), MEDIUM (Quest-only, au plus 3 images/5 s), "+
  "PRO (Quest+Paid si permis, jusqu'à 5 images/5 s).\n"+
  "Devis initial indicatif pour "+brief.duration+" s : Quest "+estimate.quest.join(" à ")+
  " Pollen ; Paid "+estimate.paid.join(" à ")+" Pollen. Les coûts sont recalculés après scénario et découpage.\n"+
  "Personnalise facultativement avec MODELE writer <id> ou FALLBACK t2i <id>, après le premier brief.\n"+
  "Confirme la durée et le mode avec SCENARIO "+brief.duration+" "+brief.tier.toUpperCase()+
  ". Aucun média n'est généré pendant l'onboarding.",st);
}

