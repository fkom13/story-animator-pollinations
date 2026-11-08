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
  const prompt=shotPrompt(shot,st.script,st.brief);
  let u=null,modelName=null;
  for(const cand of (x.ranks.t2i||[]).slice(0,2)){
   try{
    u=await toolCall(mcp,"pollinations","generateImage",{model:cand.id,prompt,
      size:st.brief.aspect==="9:16"?"720x1280":"1280x720"});
    modelName=cand.id;break;
   }catch(e){messages.push("Image "+shot.n+", "+cand.id+" : "+String(e.message||e).slice(0,100))}
  }
  if(!u){messages.push("Lot interrompu : modèle image principal et fallback indisponibles.");break}
  st.images.push({n:shot.n,url:u,model:modelName});
  if(st.images.length===1){
   st.review=await reviewFirstImage(polli,x.ranks.vision?.[0]?.id,u,prompt);
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
