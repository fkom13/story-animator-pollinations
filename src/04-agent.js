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
 let x=applyModelChoices(applyDecisionRoutes(await inspect(pollinations,mcp,tier),st?.decision),st);
 if(!msg||/^(VERIFIER|VÉRIFIER|DIAGNOSTIC|CHECK)$/i.test(msg)){
  return send(diagnosis(x,tier,true)+"\n\n"+decisionDescription(null,decisionChain(x,{tier}))+ 
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
  const b={...st.brief,tier:newTier};
  x=await inspect(pollinations,mcp,newTier);
  const decision=await decideRoutes(pollinations,x,b);
  x=applyModelChoices(applyDecisionRoutes(x,decision),st);
  st={...st,brief:b,decision};
  if(st.script){st.shots=shotPlan(st.script,b,st.classification);st.step="script";st.images=[];st.clips=[];st.voiceUrl=null;st.finalUrl=null}
  return send(diagnosis(x,newTier,true)+"\n"+decisionDescription(decision)+
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
  x=await inspect(pollinations,mcp,mode);
  const decision=st?.decision&&st?.brief?.tier===mode&&st?.brief?.duration===seconds?
    st.decision:await decideRoutes(pollinations,x,b);
  x=applyModelChoices(applyDecisionRoutes(x,decision),st);
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
  st={v:2,id:hashId(b.idea+"|"+seconds+"|"+mode),step:"script",modelOverrides:st?.modelOverrides||{},decision,
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
 const brief=detectBrief(msg);
 x=await inspect(pollinations,mcp,brief.tier);
 const decision=await decideRoutes(pollinations,x,brief);
 x=applyDecisionRoutes(x,decision);
 const classification=await classify(pollinations,x,brief);
 const roughSlots=Math.ceil(brief.duration/5)*TIERS[brief.tier].per5;
 const estimate=billEstimate(brief,x,new Array(roughSlots).fill({}));
 st={v:2,id:hashId(msg),step:"onboard",brief,classification,decision};
 return send(diagnosis(x,brief.tier,true)+
  "\n\n🎬 TON HISTOIRE\n"+brief.idea+
  "\n"+decisionDescription(decision)+"\nClassification : "+classification.genre+" / "+classification.imageStyle+
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
