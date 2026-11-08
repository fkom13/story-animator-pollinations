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
function cleanedDialogue(text){
 return String(text||"").replace(/^[^:]{1,35}:\s*/,"").replace(/[«»]/g,"")
  .replace(/\s*[—–]\s*puis\s*:\s*/gi," ").replace(/\s+/g," ").trim();
}
function beatTiming(visual,duration){
 const m=String(visual).match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
 if(!m)return null;
 const start=60*Number(m[1])+Number(m[2]),end=60*Number(m[3])+Number(m[4]);
 return start>=0&&end>start&&end<=duration+1?{start,end}:null;
}
function normalizeScript(a,brief){
 const beats=(Array.isArray(a.beats)?a.beats:[]).slice(0,Math.min(24,Math.ceil(brief.duration/2))).map((b,i)=>({
  title:String(b.title||"Moment "+(i+1)).slice(0,120),
  visual:String(b.visual||brief.idea).slice(0,550),
  spoken:String(b.spoken||b.speech||"").slice(0,500),
  intensity:Math.max(0,Math.min(1,Number(b.intensity)||0.5)),
  camera:String(b.camera||"cinematic").slice(0,45),
  timing:beatTiming(b.visual,brief.duration)
 }));
 if(!beats.length)beats.push({title:"Plan d'introduction",visual:brief.idea,spoken:"",intensity:0.5,camera:"dolly"});
 const rawVoice=String(a.voiceover||"");
 const dialogueText=beats.map(b=>cleanedDialogue(b.spoken)).filter(Boolean).join(" ");
 const isDirection=/\b(?:diction|mixage|sound design|dialogues joués|sous-titres incrustés|voix off f[ée]minine|voix off masculine)\b/i.test(rawVoice);
 const voiceover=(isDirection||rawVoice.length<18?dialogueText:cleanedDialogue(rawVoice)).slice(0,12000);
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
  const timed=script.beats.find(b=>b.timing&&st>=b.timing.start&&st<b.timing.end);
  const beat=timed||script.beats[Math.min(script.beats.length-1,Math.floor(st/seconds*script.beats.length))];
  const beatIndex=script.beats.indexOf(beat);
  const intensity=.65*beat.intensity+.35*classification.energy;
  const n=brief.tier==="eco"?1:brief.tier==="medium"?(intensity<.3?1:intensity<.7?2:3):(intensity<.3?2:intensity<.7?3:5);
  for(let j=0;j<n;j++){
   const dt=total/n,phase=j/n;
   shots.push({n:index++,start:rnd(st+j*dt,3),duration:rnd(dt,3),
    intensity:rnd(intensity,2),motion:motions[(index+slot*3+j)%motions.length],
    beat:beatIndex,subshot:j,within:n});
  }
 }
 return shots;
}
function shotPrompt(shot,script,brief){
 const beat=script.beats[shot.beat]||script.beats[0];
 const view=shot.subshot===0?"wide atmospheric composition":shot.subshot===1?
   "medium expressive shot with changed perspective":"tight narrative insert or action closeup";
 return [beat.visual,script.visualBible,script.characters.join("; "),
  "photographic composition for beat "+beat.title,
  "image "+(shot.subshot+1)+"/"+shot.within,
  view,"camera direction "+shot.motion,"aspect "+brief.aspect,
  "Strict character continuity across shots, same costume and facial identity"].join("; ").slice(0,1500);
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
