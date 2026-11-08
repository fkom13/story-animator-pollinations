/**
 * Story Animator — Pollinations Community Code Agent
 * One self-contained file. Public repository; no private pipeline or API keys.
 * Deployed by Pollinations (not executed on GitHub).
 *
 * Safety: planning costs a small text-model request; media production requires
 * a storyboard, preflight and an explicit second confirmation.
 */
const VERSION = "0.1.3";
const MODEL_PREFERENCES = {
  script: ["deepseek/deepseek-v4.1-flash", "openai/gpt-6-luna", "minimax/minimax-m3.1-flash"],
  production: ["openai/gpt-5.4-nano", "openai/gpt-6-luna", "deepseek/deepseek-v4.1-flash"],
  t2i: ["black-forest-labs/flux.1-schnell", "tongyi-mai/z-image-turbo"],
  i2i: ["black-forest-labs/flux.2-klein-4b", "microsoft/mai-image-2.6-flash"],
  tts: ["microsoft/mai-voice-2.1-flash", "openai/tts-1"],
  stt: ["microsoft/mai-transcribe-2", "openai/whisper-large-v3"]
};
const REQUIRED_CATEGORIES = ["text", "image", "audio"];
const MAX_SECONDS = 15;
const MAX_SCENES = 3;
// No artificial Pollen spending ceiling. Account/key limits remain authoritative.
function reply(message, status=200, stream=false) {
  const id="resp_"+crypto.randomUUID(), mid="msg_"+crypto.randomUUID();
  const part={type:"output_text",text:message,annotations:[]};
  const item={id:mid,type:"message",role:"assistant",status:"completed",content:[part]};
  const result={
    id,object:"response",created_at:Math.floor(Date.now()/1000),
    model:"story-animator-pollinations",status:"completed",
    error:status>=400?{code:"agent_preflight_error",message}:null,
    incomplete_details:null,output:[item],
    usage:{input_tokens:0,output_tokens:0,total_tokens:0},
    message,version:VERSION
  };
  if(!stream) return Response.json(result,{status});
  const events=[];
  const push=(name,data)=>events.push("event: "+name+"\ndata: "+JSON.stringify({type:name,sequence_number:events.length,...data})+"\n\n");
  push("response.created",{response:{...result,status:"in_progress",output:[]}});
  push("response.in_progress",{response:{...result,status:"in_progress",output:[]}});
  push("response.output_item.added",{output_index:0,item:{...item,status:"in_progress",content:[]}});
  push("response.content_part.added",{item_id:mid,output_index:0,content_index:0,part:{...part,text:""}});
  push("response.output_text.delta",{item_id:mid,output_index:0,content_index:0,delta:message,logprobs:[]});
  push("response.output_text.done",{item_id:mid,output_index:0,content_index:0,text:message,logprobs:[]});
  push("response.content_part.done",{item_id:mid,output_index:0,content_index:0,part});
  push("response.output_item.done",{output_index:0,item});
  push("response.completed",{response:result});
  events.push("data: [DONE]\n\n");
  return new Response(events.join(""),{status,headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache"}});
}
function textOf(v) {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(x => typeof x === "string" ? x : (x && (x.text || x.content || ""))).join("\n");
  return typeof v?.text === "string" ? v.text : "";
}
function getMessages(payload) {
  if (Array.isArray(payload?.messages)) return payload.messages;
  if (Array.isArray(payload?.input)) return payload.input;
  if (typeof payload?.input === "string") return [{role:"user",content:payload.input}];
  return [];
}
function lastUser(messages) {
  const m = [...messages].reverse().find(x => x.role === "user");
  return m ? textOf(m.content) : "";
}
function lastPlan(messages) {
  const expression = /\[\[STORY_PLAN:([A-Z0-9]{6,16})\|MODE:(quest|plus)\|DURATION:(\d{1,2})\|SCENES:(\d{1,2})\|BUDGET:([0-9.]+)\]\]/i;
  for (const m of [...messages].reverse()) {
    if (m.role !== "assistant") continue;
    const found = textOf(m.content).match(expression);
    if (found) return {id:found[1].toUpperCase(),mode:found[2].toLowerCase(),duration:Number(found[3]),scenes:Number(found[4]),budget:Number(found[5])};
  }
  return null;
}
function lastPreflight(messages,id) {
  const exp = new RegExp("\\[\\[PREFLIGHT_OK:"+id+"\\]\\]","i");
  return [...messages].reverse().some(m => m.role==="assistant" && exp.test(textOf(m.content)));
}
function planId(userText) {
  let h = 2166136261;
  for (const c of userText.slice(0,4000)) {h ^= c.charCodeAt(0);h=Math.imul(h,16777619);}
  return ("00000000"+(h>>>0).toString(16).toUpperCase()).slice(-8);
}
function idFromCommand(input,prefix) {
  const m = input.trim().match(new RegExp("^"+prefix+"\\s+([A-Z0-9]{6,16})\\s*$","i"));
  return m && m[1].toUpperCase();
}
function modelsOf(response) {
  const items = Array.isArray(response) ? response : (response?.data || []);
  return new Map(items.filter(m => m && typeof m.id==="string").map(m => [m.id,m]));
}
function chooseModels(list,mode="quest") {
  const picked={}, missing=[];
  for (const [category,preferences] of Object.entries(MODEL_PREFERENCES)) {
    const id = preferences.find(id => {
      const m = list.get(id);
      if (!m) return false;
      if (mode==="quest" && m.paid_only!==false) return false;
      const input=m.input_modalities||[],output=m.output_modalities||[],eps=m.supported_endpoints||[];
      if (category==="script") return output.includes("text");
      if (category==="production") return output.includes("text") && (m.capabilities||[]).includes("tool_calling");
      if (category==="t2i") return output.includes("image") && eps.includes("/v1/images/generations");
      if (category==="i2i") return input.includes("image") && eps.includes("/v1/images/edits");
      if (category==="tts") return output.includes("audio") && eps.includes("/v1/audio/speech");
      if (category==="stt") return eps.includes("/v1/audio/transcriptions");
      return false;
    });
    if (id) picked[category]=id; else missing.push(category);
  }
  return {picked,missing};
}
function stringArray(x) {
  if (Array.isArray(x)) return x.filter(y=>typeof y==="string");
  if (typeof x==="string") return x.split(/[,\s]+/).filter(Boolean);
  return null;
}
function keyAllowedModels(key) {
  for (const v of [key?.permissions?.models,key?.allowedModels,key?.allowed_models,key?.models,key?.modelAccess,key?.model_access,key?.limits?.models]) {
    const out=stringArray(v);
    if(out) return out;
  }
  return null;
}
function keyPermissions(key) {
  return stringArray(key?.permissions?.account) || stringArray(key?.permissions) || stringArray(key?.scopes) || stringArray(key?.scope) || [];
}
function isAllowedByKey(allowed,id,category) {
  if (!allowed) return null;
  return allowed.includes("*") || allowed.includes("all") || allowed.includes(id) || allowed.includes(category);
}
async function polliJson(pollinations,path) {
  const r=await pollinations(path,{method:"GET"});
  if (!r || typeof r.ok !== "boolean") throw Error("Réponse API Pollinations non reconnue: "+path);
  if(!r.ok) throw Error(path+" : HTTP "+r.status);
  return await r.json();
}
async function obtainCatalog(pollinations) {
  return modelsOf(await polliJson(pollinations,"/v1/models"));
}
function mcpList(value) {
  if (Array.isArray(value)) return value;
  return value?.tools || value?.data || [];
}
async function runPreflight({pollinations,mcp},plan) {
  const messages=[], problems=[];
  if (!plan) return {ok:false,problems:["Storyboard introuvable. Recommencer la proposition."],messages};
  if(plan.duration>MAX_SECONDS || plan.scenes>MAX_SCENES || plan.duration<=0 || plan.scenes<=0) {
    problems.push("Pour ce pilote, seul le format validé de 15 secondes et 3 scènes est exécutable (ce n’est pas une limite financière).");
  }
  let registry=new Map(),key=null,balance=null;
  try {registry=await obtainCatalog(pollinations);} catch(e){problems.push("Catalogue modèles inaccessible : "+e.message);}
  const selected=chooseModels(registry,plan.mode);
  for(const c of selected.missing) problems.push("Aucun modèle adapté disponible : "+c);
  try {
    key=await polliJson(pollinations,"/account/key");
  }catch(e){problems.push("Impossible de vérifier la clé du demandeur : "+e.message);}
  if(key) {
    const scopes=keyPermissions(key);
    const allowed=keyAllowedModels(key);
    if(key.valid===false || key.revoked===true || key.expired===true) problems.push("Clé désactivée ou expirée.");
    if(key.type==="publishable" || key.type==="app") problems.push("Cette clé de type App Key n'autorise pas les générations.");
    if(allowed) {
      for (const [category,id] of Object.entries(selected.picked)) {
        const kind = (category==="script" || category==="production")?"text":(category==="t2i"||category==="i2i"?"image":"audio");
        if (!isAllowedByKey(allowed,id,kind)) problems.push("Modèle refusé par la restriction de clé : "+id);
      }
    } else messages.push("Les restrictions fines de modèles ne sont pas exposées par la réponse de clé ; le serveur contrôlera les appels.");
    messages.push("Permissions compte visibles : "+(scopes.length?scopes.join(", "):"non exposées")+".");
  }
  try {balance=await polliJson(pollinations,"/account/balance");}
  catch(e) {problems.push("Solde/budget inaccessible : "+e.message+" (une clé limitée peut nécessiter account:usage).");}
  if(balance) {
    const available=Number(balance.balance);
    if(Number.isFinite(available) && available<plan.budget) problems.push("Budget de clé insuffisant : "+available+" Pollen visibles.");
    if (plan.mode==="quest") {
      const tier=Number(balance.accountBalance?.tier);
      if (!balance.accountBalance || !Number.isFinite(tier)) {
        messages.push("Mode Quest First : solde Quest masqué par le jeton délégué. Les modèles paid_only sont exclus, mais le repli vers Paid reste possible si la clé ne porte pas questPollenOnly.");
      } else if (tier < plan.budget) {
        messages.push("Solde Quest insuffisant pour couvrir l'estimation : un repli Paid pourrait intervenir, sauf si la clé l'interdit.");
      }
      if (key?.questPollenOnly === false) messages.push("La clé permet le repli sur Paid si le Quest disponible ne suffit pas.");
    }
  }
  const tools={};
  for(const server of ["pollinations","ffmpeg"]) {
    try {
      const listed=mcpList(await mcp.listTools(server));
      tools[server]=listed.map(t=>t.name||t.id).filter(Boolean);
      if(!tools[server].length) problems.push("Catalogue MCP "+server+" vide.");
    }catch(e){problems.push("MCP "+server+" inaccessible : "+e.message);}
  }
  const toolText=[...(tools.pollinations||[])].join(" ").toLowerCase();
  const ff=(tools.ffmpeg||[]).join(" ").toLowerCase();
  if(!/image/.test(toolText)) problems.push("Pas d'outil MCP de génération d'images détecté.");
  if(!/(speech|audio|tts)/.test(toolText)) problems.push("Pas d'outil de voix audio détecté.");
  if(!/(ffmpeg|run)/.test(ff)) problems.push("Pas d'outil FFmpeg détecté.");
  // account:keys is never required and must never be requested.
  return {ok:problems.length===0,problems,messages,selected:selected.picked,tools,
    visibleBalance:balance?{keyBudget:balance.balance,quest:balance.accountBalance?.tier??null}:null};
}
function toolCategory(name) {
  const s=name.toLowerCase();
  if(/image|edit|picture|visual/.test(s)) return "image";
  if(/speech|tts|audio|transcri|voice/.test(s)) return "audio";
  if(/ffmpeg|render|video|media/.test(s)) return "ffmpeg";
  return null;
}
// Verified against the Pollinations FFmpeg MCP (2026-11-08).
// A still image without -loop is only one frame; never use -shortest here.
// This V1 preset is deliberately restricted to the validated 3 x 5-second format.
function verifiedFfmpegPreset(sources,plan) {
  if(plan.duration!==15 || plan.scenes!==3) {
    throw Error("Preset de rendu validé uniquement pour 15 secondes et 3 scènes. Aucun rendu lancé dans un format non testé.");
  }
  if(!Array.isArray(sources) || ![4,5].includes(sources.length) ||
     !sources.every(u=>typeof u==="string" && /^https:\/\/media\.pollinations\.ai\/[a-zA-Z0-9-]+$/.test(u))) {
    throw Error("FFmpeg attend 3 URLs d'images Pollinations, puis 1 URL audio et éventuellement 1 URL SRT (dans cet ordre).");
  }
  const moves=[
    "z='1+0.19*on/124':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2'",
    "z='1.18-0.13*on/124':x='(iw-iw/zoom)*on/124':y='(ih-ih/zoom)/2'",
    "z='1.04+0.15*on/124':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2'"
  ];
  const parts=moves.map((motion,i)=>{
    const fade=i<2?",fade=t=in:st=0:d=0.2,fade=t=out:st=4.8:d=0.2":",fade=t=in:st=0:d=0.2";
    return "["+i+":v]scale=960:540:force_original_aspect_ratio=increase,crop=960:540,zoompan="+motion+
      ":d=1:fps=25:s=640x360"+fade+"[v"+i+"]";
  });
  const captions=sources.length===5
    ?",subtitles=input4:force_style='FontSize=17,Outline=1,Alignment=2,MarginV=18'"
    :"";
  const filter=parts.join(";")+";[v0][v1][v2]concat=n=3:v=1:a=0"+captions+
    "[v];[3:a]apad,atrim=duration=15[a]";
  const args=[];
  for(let i=0;i<3;i++) args.push("-loop","1","-framerate","25","-t","5","-i","input"+i);
  args.push("-i","input3","-filter_complex",filter,"-map","[v]","-map","[a]","-t","15",
    "-r","25","-c:v","libx264","-preset","veryfast","-crf","26","-pix_fmt","yuv420p",
    "-c:a","aac","-b:a","96k","-movflags","+faststart");
  if(args.length>64 || filter.length>1024) throw Error("Preset trop long pour le MCP FFmpeg.");
  return {sources,args,outputExtension:"mp4"};
}
function exposedTools(catalog,pick,plan) {
  // Do not expose account management, web, computer, arbitrary-code, or video-model tools.
  const merged={},maxCalls=13;
  let calls=0;
  for(const [name,definition] of Object.entries(catalog)) {
    const kind=toolCategory(name);
    if(!kind || !(kind==="image"||kind==="audio"||kind==="ffmpeg")) continue;
    if(kind==="ffmpeg" && !/ffmpeg|run/i.test(name)) continue;
    if(kind==="image" && /video/i.test(name)) continue;
    const execute=definition?.execute;
    if(typeof execute!=="function") continue;
    merged[name]={...definition,execute:async (args,...other)=>{
      if(++calls>maxCalls) throw Error("Plafond de 13 outils par film atteint ; aucune nouvelle dépense permise.");
      if(kind==="image"||kind==="audio") {
        const modelId=args?.model || args?.modelId || args?.model_id;
        if(typeof modelId!=="string") throw Error("Chaque génération exige un identifiant de modèle autorisé.");
        const authorized=Object.values(pick);
        if(!authorized.includes(modelId)) throw Error("Modèle absent de la whitelist vérifiée : "+modelId);
        if(plan.mode==="quest" && !authorized.includes(modelId)) throw Error("Quest First : modèle refusé.");
      }
      if(kind==="ffmpeg") {
        const pinned=verifiedFfmpegPreset(args?.sources,plan);
        return execute(pinned,...other);
      }
      return execute(args,...other);
    }};
  }
  return merged;
}
function onboardingInstructions(id) {
  return [
    "Tu es Story Animator, un réalisateur français chaleureux, précis, créatif et économe. Version "+VERSION+".",
    "Tu réalises EXCLUSIVEMENT des films à partir d'images fixes animées par FFmpeg : T2I / I2I, zoompan, panoramiques, fondus. STRICTEMENT AUCUN modèle T2V, I2V, Kling, Veo, Runway, Sora, ni clips vidéo générés par IA.",
    "Dialoguer naturellement. À partir d'une idée, demander seulement les paramètres manquants : durée 15 secondes et 3 scènes (preset vérifié), format 16:9, style, langue, ton et mode Quest First ou Qualité Plus.",
    "Par défaut : Quest First, 15 secondes, 3 scènes, 16:9. Quest First sélectionne les modèles compatibles Quest mais ne garantit pas que Paid ne sera jamais utilisé. Ne jamais réclamer de clé, de token, ni de secret.",
    "Proposer un synopsis et trois scènes avec narration, prompts d'images et mouvements caméra zoompan/pan. Ne jamais promettre une qualité/une disponibilité non testée.",
    "Pour chaque scène préciser durée, personnage, cohérence visuelle, texte dit, image de référence, mouvement. Trois scènes de cinq secondes pour une demande de 15 s. Ecrire une narration PRONONÇABLE en 15 secondes maximum, idéalement 25 à 32 mots au total.",
    "Afficher UNIQUEMENT les modèles T2I, I2I, TTS et STT candidats présents dans nos préférences. Ne pas citer de modèle vidéo. Donner une estimation facultative des frais en Pollen, SANS plafond artificiel ni promesse de ne jamais le dépasser. Les limites imposées par la clé Pollinations demeurent applicables.",
    "Quand le storyboard est complet, écrire EXACTEMENT le marqueur [[STORY_PLAN:"+id+"|MODE:quest|DURATION:15|SCENES:3|BUDGET:0.5]]. Le champ BUDGET est une estimation indicative, pas un plafond.",
    "Si l'utilisateur a choisi 'Qualité Plus', remplacer MODE:quest par MODE:plus. Le format 30 secondes et les formats non 16:9 seront ajoutés après validation de presets distincts.",
    "Ne jamais écrire un marqueur d'approbation de sécurité.",
    "Demander à l'utilisateur de répondre exactement PRODUIRE "+id+" pour déclencher les contrôles des autorisations avant montage.",
    "La création de scénario utilise un modèle texte facturé à l'appelant; aucun média n'est généré dans cette phase.",
    "L'API étant stateless, rappeler de conserver la même conversation avec l'historique ou le storyboard.",
    "IMPORTANT : ne jamais prétendre avoir généré d'audio, d'image ou de film lorsque les outils ne sont pas utilisés."
  ].join("\n");
}
function productionInstructions(plan,selected) {
  return [
    "Tu es Story Animator. Une demande de production a passé le contrôle des droits, des modèles, du budget de clé et des MCP. L'estimation n'est pas un plafond.",
    "Créer un film narratif d'images fixes animées de "+plan.duration+" secondes et "+plan.scenes+" scènes max, via les outils MCP autorisés.",
    "MODE="+plan.mode+". Modèles obligatoires :"+JSON.stringify(selected)+". Ne jamais utiliser un autre modèle, même en fallback.",
    "Utiliser les outils réels : créer 3 images T2I fixes (et éventuellement une édition I2I), une voix française de 15 secondes, une transcription si possible et une composition FFmpeg. Aucun modèle I2V/T2V. Agir par appels outils rapidement plutôt que développer une analyse longue.",
    "Si aucune transcription à horodatage n'est obtenue, produire les sous-titres approximatifs découpés d'après la durée de la narration et le dire honnêtement.",
    "Pour runFfmpeg, transmettre dans sources EXACTEMENT 3 URLs HTTPS de JPEG Pollinations (scènes 1, 2, 3) suivies de l’URL audio MP3; ajouter une 5e URL de sous-titres SRT seulement si elle existe déjà. Les arguments FFmpeg seront remplacés automatiquement par notre preset validé : -loop, zoompan dynamique et audio sur 15 secondes, sans -shortest. Ne jamais générer ni inventer une URL SRT. Ne pas appeler de modèle vidéo.",
    "Les outils reçoivent des URLs médias HTTPS publiques si nécessaires. Respecter chaque schéma d'arguments renvoyé par MCP.",
    "Limiter les appels à 13 pour un film pilote afin d'éviter les boucles inutiles ; il ne s'agit PAS d'un plafond de Pollen. Si une étape échoue, rendre compte sans inventer d'URL.",
    "Ne pas utiliser de services, clés ni dépôts privés IACA/FreeVideoMaker.",
    "Toujours publier les liens réellement renvoyés par les outils pour les images, pistes audio, MP4 et SRT/VTT si disponibles.",
    "Si le nombre ou les limites des outils empêchent le rendu, l'expliquer clairement; ne jamais déclarer le film terminé sans MP4 vérifiable.",
    "La clé de l'appelant est gérée par Pollinations, et ne doit jamais apparaître dans le chat."
  ].join("\n");
}
export default async function agent({ model, respond, mcp, pollinations, request }) {
  let payload;
  try {payload=await request.clone().json();} catch {return reply("Requête JSON attendue.",400);}
  const say=(message,status)=>reply(message,status,Boolean(payload?.stream));
  const history=getMessages(payload);
  const message=lastUser(history).trim();
  if (/^(VERIFIER|VÉRIFIER|CHECK ACCESS|STATUS)$/i.test(message)) {
    const check=await runPreflight({pollinations,mcp},{id:"CHECK",mode:"quest",duration:15,scenes:3,budget:0});
    return say("Diagnostic sans génération de médias.\nModèles autorisés : "+JSON.stringify(check.selected)+"\nMCP : "+JSON.stringify(check.tools)+"\nObservations : "+check.messages.join(" | ")+"\nBlocages : "+(check.problems.join(" | ")||"aucun"));
  }
  if(!message) return say("Bienvenue ! Donne-moi une idée d'histoire. Je proposerai 15 secondes, 3 scènes et le mode Quest First par défaut.");
  const plan=lastPlan(history);
  const producing=idFromCommand(message,"PRODUIRE");
  const confirming=idFromCommand(message,"CONFIRMER");
  if (producing || confirming) {
    const cmdId=producing||confirming;
    if(!plan || cmdId!==plan.id) return say("Storyboard ou historique manquant : réaffiche le plan et son identifiant, puis redemande une production. Aucun outil lancé.",400);
    const check=await runPreflight({pollinations,mcp},plan);
    if(!check.ok) return say("Précontrôle bloquant, aucune génération lancée.\n"+check.problems.map(x=>"- "+x).join("\n")+"\n\n"+check.messages.join("\n"));
    if(producing) {
      return say("Précontrôle réussi pour "+plan.id+".\nModèles vérifiés : "+JSON.stringify(check.selected)+"\nEstimation indicative : "+plan.budget+" Pollen (sans plafond artificiel, avec budget de clé applicable).\nClé et MCP accessibles. La possibilité de consommer Paid dépend des paramètres réels de la clé si le solde Quest est épuisé.\nPour lancer les générations payantes, réponds exactement : CONFIRMER "+plan.id+"\n[[PREFLIGHT_OK:"+plan.id+"]]");
    }
    if(!lastPreflight(history,plan.id)) return say("La confirmation préalable manque dans l'historique. Envoyer PRODUIRE "+plan.id+" d'abord ; aucun outil lancé.",400);
    try {
      const [imageTools,ffmpegTools]=await Promise.all([mcp.tools("pollinations"),mcp.tools("ffmpeg")]);
      const safe=exposedTools({...imageTools,...ffmpegTools},check.selected,plan);
      if(!Object.keys(safe).length) return say("Aucun outil média sûr détecté ; production arrêtée sans dépense.",503);
      const pickedModel=check.selected.production;
      return await respond({model:model(pickedModel),instructions:productionInstructions(plan,check.selected),tools:safe,maxOutputTokens:1800});
    }catch(e){return say("Erreur pendant l'initialisation du rendu : "+String(e.message||e).slice(0,350),503);}
  }
  // A regular conversational turn uses a low-cost, quest-compatible text model.
  let scriptModel=MODEL_PREFERENCES.script[0];
  try {scriptModel=chooseModels(await obtainCatalog(pollinations),"quest").picked.script||scriptModel;}
  catch { /* Pollinations enforces the caller's permission when the model is used. */ }
  return respond({model:model(scriptModel),instructions:onboardingInstructions(planId(message))});
}
