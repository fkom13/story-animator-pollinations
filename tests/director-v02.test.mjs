import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const source=await fs.readFile(new URL("../agent.v02.ts",import.meta.url),"utf8");
const {default:agent}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const mods=[
 {id:"openai/gpt-5.4-nano",input_modalities:["text","image"],output_modalities:["text"],supported_endpoints:["/v1/chat/completions"],capabilities:["tool_calling"],paid_only:false,pricing:{promptTextTokens:"0.00000015",completionTextTokens:"0.0000009"}},
 {id:"deepseek/deepseek-v4.1-flash",input_modalities:["text","image"],output_modalities:["text"],supported_endpoints:["/v1/chat/completions"],capabilities:["tool_calling"],paid_only:false,pricing:{promptTextTokens:"0.00000015",completionTextTokens:"0.0000006"}},
 {id:"openai/gpt-6.1-terra",input_modalities:["text","image"],output_modalities:["text"],supported_endpoints:["/v1/chat/completions"],capabilities:["tool_calling"],paid_only:false,pricing:{promptTextTokens:"0.00000075",completionTextTokens:"0.00000375"}},
 {id:"typesafe/jev-1.14",input_modalities:["text"],output_modalities:["text"],supported_endpoints:["/v1/chat/completions"],capabilities:[],paid_only:true,pricing:{promptTextTokens:"0.000000042",completionTextTokens:"0.0000001"}},
 {id:"moonshotai/kimi-k3.1-pro",input_modalities:["text","image"],output_modalities:["text"],supported_endpoints:["/v1/chat/completions"],capabilities:["tool_calling"],paid_only:true,pricing:{promptTextTokens:"0.000002",completionTextTokens:"0.00001"}},
 {id:"black-forest-labs/flux.1-schnell",input_modalities:["text"],output_modalities:["image"],supported_endpoints:["/v1/images/generations"],paid_only:false,pricing:{completionImageTokens:"0.002"}},
 {id:"black-forest-labs/flux.2-klein-4b",input_modalities:["text","image"],output_modalities:["image"],supported_endpoints:["/v1/images/generations","/v1/images/edits"],paid_only:false,pricing:{completionImageTokens:"0.005"}},
 {id:"qwen/qwen-image-2.1-turbo",input_modalities:["text","image"],output_modalities:["image"],supported_endpoints:["/v1/images/generations","/v1/images/edits"],paid_only:true,pricing:{completionImageTokens:"0.016"}},
 {id:"microsoft/mai-voice-2.1-flash",input_modalities:["text"],output_modalities:["audio"],supported_endpoints:["/v1/audio/speech"],paid_only:false,pricing:{completionAudioTokens:"0.00001125"}},
 {id:"openai/whisper-large-v3",input_modalities:["audio"],output_modalities:["text"],supported_endpoints:["/v1/audio/transcriptions"],paid_only:false,pricing:{promptAudioSeconds:"0.000045277778"}}
].map(x=>({...x,health:{status:"healthy",success_rate:99.5,requests:100}}));
const scr={title:"La fable moderne",synopsis:"Un danseur fier se fait flatter par un charmeur rusé qui lui dérobe son sandwich.",visualBible:"Rue parisienne nocturne, éclairage cinématographique photoréaliste, personnages constants",characters:["Corbeau : jeune adulte manteau noir","Renard : jeune adulte bomber roux"],beats:[{title:"La rencontre",visual:"Le corbeau perché, sandwich en main, le renard en bas",spoken:"Le renard observe le corbeau.",intensity:0.2,camera:"wide"},{title:"La flatterie",visual:"Le renard complimente le corbeau dans une ruelle",spoken:"Tu es une star, chante pour moi !",intensity:0.7,camera:"medium"},{title:"La chute",visual:"Le sandwich tombe, le renard le prend",spoken:"Le piège se referme.",intensity:0.95,camera:"action"}],voiceover:"Dans le quartier, le corbeau avait la grosse tête. Le renard le flatta, puis emporta son sandwich.",direction:"Mise en scène street, tension montante"};
function mock({models=mods,questOnly=true,permit=["*"],noAudio=false,noImage=false,budget=10,visionScore=.85}={}){
 const log=[];
 const selected=models.filter(m=>!noAudio||!m.output_modalities.includes("audio")).filter(m=>!noImage||!m.output_modalities.includes("image"));
 let mediaCounter=0;
 const env={
  pollinations:async(path,opts={})=>{
   log.push(["api",path,opts.method||"GET"]);
   if(path==="/account/key")return Response.json({valid:true,questPollenOnly:questOnly,permissions:{models:permit}});
   if(path==="/account/balance")return Response.json({balance:budget,accountBalance:{tier:budget}});
   if(path==="/v1/models")return Response.json({data:selected});
   if(path.startsWith("/models/status"))return Response.json({data:[]});
   if(path==="/v1/chat/completions"){
    const body=JSON.parse(opts.body);
    if(Array.isArray(body.messages[1].content))return Response.json({choices:[{message:{content:JSON.stringify({score:visionScore,issues:[],suggestion:"looks good"})}}]});
    const sys=body.messages[0].content;
    const output=sys.includes("Classificateur")?{genre:"fable",energy:.75,imageStyle:"photorealistic street",dialogue:true}:
      sys.includes("scénariste")||sys.includes("Tu écris")?scr:scr;
    return Response.json({choices:[{message:{content:JSON.stringify(output)}}]});
   }
   return new Response("unknown URL",{status:404});
  },
  mcp:{
   listTools:async server=>({tools:(server==="ffmpeg"?["runFfmpeg"]:["generateImage","generateAudio","transcribeAudio"]).map(name=>({name}))})
  }
 };
 const call=async(server,name,args)=>{
  log.push(["mcp",server,name,args]);
  if(noAudio&&name==="generateAudio")return {isError:true,content:[{type:"text",text:"disabled"}]};
  mediaCounter++;
  return {content:[{type:"resource_link",uri:"https://media.pollinations.ai/"+mediaCounter+"abcdef"}]};
 };
 call.listTools=env.mcp.listTools;
 return {env:{...env,mcp:call},log};
}
function req(h,stream=false){return new Request("https://gen.pollinations.ai/v1/responses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"community/fkom13/story-animator-pollinations",input:h,stream})})}
function user(s){return {role:"user",content:s}}
function assistant(s){return {role:"assistant",content:s}}
async function run(h,m){
 const result=await agent({...m.env,request:req(h)});
 const json=await result.json();
 return json.output?.[0]?.content?.[0]?.text||"";
}
test("key diagnostic immediately warns if audio generation unavailable",async()=>{
 const m=mock({noAudio:true});const out=await run([user("VERIFIER")],m);
 assert.match(out,/Narration\/dialogues audio indisponibles/);
 assert.match(out,/tts: aucun modèle autorisé/);
 assert.ok(!m.log.some(x=>x[0]==="mcp"));
});
test("user key cannot silently select paid models in Eco and Medium",async()=>{
 for(const tier of ["eco","medium"]){
  const m=mock();
  const out=await run([user("Je veux une fable "+tier+" de 60 s")],m);
  assert.match(out,/Quest-only/);
  assert.ok(!out.includes("principal moonshotai/kimi-k3.1-pro"));
 }
});
test("Pro tier includes Paid candidates and classifier JEV if it ranks highest",async()=>{
 const m=mock({questOnly:false});
 const out=await run([user("Une fable street 60 s pro")],m);
 assert.match(out,/Paid/);
 assert.match(out,/typesafe\/jev-1.14/);
});
test("runtime health removes unavailable models and matches user's key model restrictions",async()=>{
 const restricted=mock({permit:["openai/gpt-5.4-nano","black-forest-labs/flux.1-schnell"]});
 const out=await run([user("VERIFIER")],restricted);
 assert.match(out,/tts: aucun modèle autorisé/);
 assert.doesNotMatch(out,/principal deepseek/);
});
test("intelligent scene segmentation obeys tier limits for 60 second scenes",async()=>{
 for(const [tier,max] of [["eco",12],["medium",36],["pro",60]]){
  const m=mock({questOnly:tier!=="pro"}),history=[user("Le corbeau et le renard en street photoréaliste 60 s "+tier)];
  const first=await run(history,m);history.push(assistant(first),user("SCENARIO 60 "+tier.toUpperCase()));
  const plan=await run(history,m);
  assert.match(plan,/Découpage pour 60 s/);
  const match=plan.match(/Découpage pour 60 s : (\d+) images/);
  assert.ok(match);
  assert.ok(Number(match[1])<=max);
  assert.ok(Number(match[1])>=12);
 }
});
test("no pre-defined 15/30/60 duration restriction at storyboard stage",async()=>{
 const m=mock({questOnly:false}),h=[user("Une fable de 85 secondes pro")];
 const a=await run(h,m);h.push(assistant(a),user("SCENARIO 85 PRO"));
 const out=await run(h,m);assert.match(out,/Découpage pour 85 s/);
});
test("without Quest-only permission production is blocked BEFORE media spend",async()=>{
 const m=mock({questOnly:false});const h=[user("Une fable 15 secondes eco")];
 let t=await run(h,m);h.push(assistant(t),user("SCENARIO 15 ECO"));
 t=await run(h,m);h.push(assistant(t));
 const id=t.match(/VALIDER SCRIPT ([A-F0-9]{8})/)[1];
 h.push(user("VALIDER SCRIPT "+id));t=await run(h,m);h.push(assistant(t),user("VALIDER PRODUCTION "+id));
 t=await run(h,m);assert.match(t,/Production arrêtée/);
 assert.equal(m.log.filter(x=>x[0]==="mcp").length,0);
});
test("one-minute ECO workflow respects approvals and does not duplicate generated images across batches",async()=>{
 const m=mock(),h=[user("Le corbeau et le renard photoréaliste street 60 secondes eco")];
 let out=await run(h,m);h.push(assistant(out),user("SCENARIO 60 ECO"));
 out=await run(h,m);const id=out.match(/VALIDER SCRIPT ([A-F0-9]{8})/)[1];h.push(assistant(out));
 h.push(user("VALIDER SCRIPT "+id));out=await run(h,m);h.push(assistant(out));
 h.push(user("VALIDER PRODUCTION "+id));out=await run(h,m);assert.match(out,/images 4\/12/);h.push(assistant(out));
 for(let i=0;i<2;i++){h.push(user("CONTINUER"));out=await run(h,m);h.push(assistant(out))}
 assert.match(out,/images 12\/12/);
 assert.equal(m.log.filter(x=>x[0]==="mcp"&&x[2]==="generateImage").length,12);
 let steps=0;while(!out.includes("MP4 final produit")&&steps++<10){h.push(user("CONTINUER"));out=await run(h,m);h.push(assistant(out))}
 assert.match(out,/MP4 final produit/);
 assert.equal(m.log.filter(x=>x[0]==="mcp"&&x[2]==="generateImage").length,12);
 assert.equal(m.log.filter(x=>x[0]==="mcp"&&x[2]==="generateAudio").length,1);
 assert.ok(m.log.some(x=>x[0]==="mcp"&&x[1]==="ffmpeg"));
});
test("FFmpeg segments use loops and varied camera motion, no -shortest",async()=>{
 const m=mock(),h=[user("Robot Paris photoréaliste street 15 secondes eco")];
 let out=await run(h,m);h.push(assistant(out),user("SCENARIO 15 ECO"));
 out=await run(h,m);const id=out.match(/VALIDER SCRIPT ([A-F0-9]{8})/)[1];h.push(assistant(out),user("VALIDER SCRIPT "+id));
 out=await run(h,m);h.push(assistant(out),user("VALIDER PRODUCTION "+id));out=await run(h,m);h.push(assistant(out));
 h.push(user("CONTINUER"));out=await run(h,m);h.push(assistant(out));
 const rendered=m.log.filter(x=>x[0]==="mcp"&&x[2]==="runFfmpeg")[0];
 assert.ok(rendered);
 const args=rendered[3].args;
 assert.ok(args.includes("-loop"));
 assert.ok(!args.includes("-shortest"));
 assert.match(args[args.indexOf("-filter_complex")+1],/zoompan/);
});
