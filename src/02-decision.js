/* Story Animator v0.2.1 — typed decision models, with deterministic last resort.
 * Decision model availability is discovered from the caller's LIVE Pollinations catalog.
 * This module never handles a raw key. The delegated pollinations() client sends requests.
 */
const DECISION_PREFERENCE=[
 {id:"vllm-sr/d3",billing:"Free",privacy:"Peut conserver les entrées pour entraînement (voir conditions du fournisseur)."},
 {id:"typesafe/jev-1.14",billing:"Paid",privacy:"Accès Paid uniquement si autorisé."},
 {id:"microsoft/microsoft-decision-1",billing:"Quest",privacy:"Compatibilité Quest ; la clé doit autoriser la consommation."}
];
const DECISION_ROLES=["writer","director","t2i","i2i","tts","vision","orchestrator","stt"];
function decisionAllowed(m,x,brief){
 if(!m||m.health?.status==="down"||!Array.isArray(m.supported_endpoints)||
    !m.supported_endpoints.includes("/v1/chat/completions"))return false;
 if(permission(x.key,m)==="denied")return false;
 if(x.key?.valid===false||x.key?.revoked===true||x.key?.expired===true)return false;
 const paid=m.paid_only===true;
 // Key-side entitlement AND project-level authorization are separate.
 // Eco and Medium are strictly Quest-only even when the key can technically buy Paid.
 if(paid&&!(brief.tier==="pro"&&x.key?.questPollenOnly===false))return false;
 return true;
}
function decisionChain(x,brief){
 // Preference is NOT availability: every model must be present in the caller's LIVE catalog.
 const byId=new Map((x.models||[]).map(m=>[m.id,m]));
 const allowed=[];
 for(const preferred of DECISION_PREFERENCE){
  const m=byId.get(preferred.id);
  if(decisionAllowed(m,x,brief)){
    if(preferred.billing==="Free" && m.paid_only===true)continue;
    if(preferred.billing==="Quest" && m.paid_only!==false)continue;
    if(preferred.billing==="Paid" && m.paid_only!==true)continue;
    allowed.push({...preferred,id:m.id});
  }
 }
 // Positions are automatically compressed when Paid is disabled.
 return allowed;
}
function candidateForDecision(m,role){
 const p=m.price===null?"inconnu":m.price;
 return {
  id:m.id,scoreJavascript:m.score,prixEstimePollen:p,
  paid:m.paid,benchmark:m.benchIndex??null,
  sante:m.health,fiabilite:m.success,latenceMs:m.latency??null,
  toolCalling:role==="orchestrator",categorie:role
 };
}
function filmDecisionWeights(brief,role){
 const tier=brief.tier||"eco";
 const weights=tier==="eco"?
  {qualite:0.30,prix:0.38,fiabilite:0.22,rapidite:0.10}:
  tier==="medium"?
  {qualite:0.54,prix:0.17,fiabilite:0.20,rapidite:0.09}:
  {qualite:0.69,prix:0.06,fiabilite:0.18,rapidite:0.07};
 if(role==="i2i"){weights.qualite+=0.06;weights.prix-=0.06}
 if(role==="writer"||role==="director"){weights.qualite+=0.04;weights.prix-=0.04}
 weights.qualite=rnd(weights.qualite,4);weights.prix=rnd(weights.prix,4);
 return weights;
}
function makeDecisionProblem(x,brief){
 const state={
  histoire:String(brief.idea||"").slice(0,1250),dureeSecondes:brief.duration,
  style:brief.style,format:brief.aspect,qualite:brief.tier,
  permissions:"Modèles déjà filtrés par le backend JS, ne choisir QUE dans les options.",
  candidats:{},ponderations:{}
 };
 const questions={},choices={};
 for(const role of DECISION_ROLES){
  const candidates=(x.ranks?.[role]||[]).slice(0,3);
  if(candidates.length<2)continue;
  choices[role]=candidates.map(m=>m.id);
  state.candidats[role]=candidates.map(m=>candidateForDecision(m,role));
  state.ponderations[role]=filmDecisionWeights(brief,role);
  const options={};
  for(let i=0;i<candidates.length;i++)options["ABC"[i]]=
    "Candidat "+("ABC"[i])+" : "+candidates[i].id;
  const artistic=(role==="writer"||role==="director")?
   "creativite, intelligence narrative, coherence des personnages, contexte et capacites":
   role==="t2i"||role==="i2i"?
   "photoréalisme adapté au scénario, continuité des identités, références et cadrages":
   role==="tts"?"voix naturelle, langue et expressivité":
   role==="vision"?"reconnaissance des défauts de la première image":
   "capacités techniques et fiabilité";
  questions["best_"+role]={
   type:"choice",
   instructions:"Choisis UN candidat autorisé pour "+role+" en respectant les pondérations de state.ponderations."+role+
    ". Prends en compte "+artistic+", le prix réel, l'état du modèle, la qualité et l'intention artistique du film. "+
    "Ne choisis jamais un candidat non listé. Les scores JavaScript sont des estimations, pas une vérité absolue.",
   criteria:options
  };
 }
 return {state,questions,choices};
}
function decodeDecisionAnswer(payload,problem){
 const data=payload?.answers&&typeof payload.answers==="object"?payload.answers:payload;
 if(!data||typeof data!=="object")throw Error("Réponse décisionnelle non structurée");
 const selection={},details={};
 for(const [role,items] of Object.entries(problem.choices)){
  const entry=data["best_"+role];
  if(!entry||typeof entry!=="object"||entry.type!=="choice")throw Error("Champ de choix absent : "+role);
  const index="ABC".indexOf(String(entry.choice||""));
  if(index<0||index>=items.length)throw Error("Choix invalide pour "+role);
  const probabilities=entry.probabilities||{};
  const confidence=entry.confidence;
  if(typeof confidence!=="number"||!Number.isFinite(confidence)||confidence<0||confidence>1)
   throw Error("Confiance non valide : "+role);
  for(const v of Object.values(probabilities))
   if(typeof v!=="number"||!Number.isFinite(v)||v<0||v>1)
    throw Error("Probabilités non valides : "+role);
  selection[role]=items[index];
  details[role]={choice:entry.choice,confidence:rnd(confidence,4),probability:
   typeof probabilities[entry.choice]==="number"?rnd(probabilities[entry.choice],4):null};
 }
 return {selection,details};
}
async function callDecision(pollinations,m,problem){
 const payload={
  model:m.id,stream:false,max_tokens:1800,
  messages:[{role:"user",content:JSON.stringify({
    state:problem.state,questions:problem.questions
  })}]
 };
 const out=await api(pollinations,"/v1/chat/completions",{
  method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)
 });
 const raw=out.choices?.[0]?.message?.content;
 const parsed=parseJson(txt(raw));
 if(!parsed)throw Error("Aucune réponse JSON de "+m.id);
 return decodeDecisionAnswer(parsed,problem);
}
function applyDecisionRoutes(x,decision){
 if(!decision||decision.engine==="javascript")return x;
 for(const [role,id] of Object.entries(decision.selection||{})){
  const list=x.ranks?.[role]||[];
  const i=list.findIndex(m=>m.id===id);
  if(i>0)list.unshift(list.splice(i,1)[0]); // JS has already filtered permissions and Paid.
 }
 return x;
}
function decisionDescription(decision,chain){
 const path=(chain||decision?.chain||[]).map((e,i)=>
  (i+1)+". "+e.id+" ["+e.billing+"]").join(" → ");
 const js=(chain||decision?.chain||[]).length+1;
 const heading="Arbitrage des modèles : "+(path?path+" → ":"")+"final "+js+
  ". JavaScript (secours déterministe).";
 if(!decision)return heading;
 const attempted=(decision.attempts||[]).map(a=>a.id+" : "+a.status).join("; ");
 return heading+"\nDécideur utilisé : "+(decision.engine==="javascript"?"pipeline JS":decision.engine)+
  (attempted?" ; essais : "+attempted:"")+
  (decision.engine==="vllm-sr/d3"?
   "\nConfidentialité : D3 Free peut journaliser ses entrées et les utiliser pour l'entraînement.":"");
}
async function decideRoutes(pollinations,x,brief){
 const chain=decisionChain(x,brief);
 const problem=makeDecisionProblem(x,brief);
 const attempts=[];
 if(!Object.keys(problem.questions).length)
  return {engine:"javascript",selection:{},details:{},attempts,chain,reason:"Pas de catégorie avec plusieurs modèles."};
 for(const candidate of chain){
  try{
   const outcome=await callDecision(pollinations,candidate,problem);
   attempts.push({id:candidate.id,status:"ok"});
   return {engine:candidate.id,billing:candidate.billing,
     selection:outcome.selection,details:outcome.details,
     attempts,chain};
  }catch(e){
   // 401, 402, 429, 5xx, timeouts and malformed outputs all cause a safe fallback.
   attempts.push({id:candidate.id,status:"échec : "+String(e.message||e).slice(0,110)});
  }
 }
 return {engine:"javascript",selection:{},details:{},attempts,chain,
  reason:"Aucun modèle de décision n'a répondu correctement. Classement JS conservé."};
}
