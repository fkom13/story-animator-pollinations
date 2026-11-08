import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source = await readFile(new URL("../agent.ts",import.meta.url),"utf8");
const {default:agent} = await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const models = [
  ["minimax/minimax-m3.1-flash",["text"],["text"],["/v1/chat/completions"]],
  ["black-forest-labs/flux.1-schnell",["text"],["image"],["/v1/images/generations"]],
  ["black-forest-labs/flux.2-klein-4b",["text","image"],["image"],["/v1/images/generations","/v1/images/edits"]],
  ["microsoft/mai-voice-2.1-flash",["text"],["audio"],["/v1/audio/speech"]],
  ["microsoft/mai-transcribe-2",["audio"],["text"],["/v1/audio/transcriptions"]]
].map(([id,input_modalities,output_modalities,supported_endpoints])=>({id,input_modalities,output_modalities,supported_endpoints,paid_only:false}));
const plan="[[STORY_PLAN:ABCDEF12|MODE:quest|DURATION:15|SCENES:3|BUDGET:0.25]]";
const preflight="[[PREFLIGHT_OK:ABCDEF12]]";
function mocks({limit=2,quest=1,toolAccess=true,keyModels=["text","image","audio"],accountUsage=true}={}) {
  let runs=0;
  const env={
    model:id=>({model:id}),
    respond:async x=>x,
    pollinations:async path=>{
      const out=path==="/v1/models"?{data:models}:path==="/account/key"?{valid:true,type:"secret",models:keyModels,permissions:accountUsage?["account:usage"]:[]}:path==="/account/balance"?(accountUsage?{balance:limit,accountBalance:{total:limit,tier:quest,paid:limit-quest}}:{balance:limit}):{};
      return new Response(JSON.stringify(out),{status:200});
    },
    mcp:{
      listTools:async server=>{
        if(!toolAccess) throw Error("403");
        return {tools:(server==="ffmpeg"?["runFfmpeg"]:["generateImage","generateSpeech","transcribeAudio"]).map(name=>({name}))};
      },
      tools:async server=>{
        const names=server==="ffmpeg"?["runFfmpeg"]:["generateImage","generateSpeech","transcribeAudio"];
        return Object.fromEntries(names.map(name=>[name,{description:name,inputSchema:{},execute:async()=>{runs++;return {ok:true};}}]));
      }
    }
  };
  return {...env,getRuns:()=>runs};
}
const request=(messages)=>new Request("https://example.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"tester/story-animator",messages})});
async function invoke(messages,mock=mocks()) {return agent({...mock,request:request(messages)});}
const user=(content)=>({role:"user",content});
const assistant=(content)=>({role:"assistant",content});
test("onboarding: no media tools provided, low-cost text model", async()=>{
  const r=await invoke([user("Une histoire drôle de robot")]);
  assert.equal(r.model.model,"minimax/minimax-m3.1-flash");
  assert.equal(r.tools,undefined);
  assert.match(r.instructions,/15 secondes/);
});
test("cannot produce without storyboard",async()=>{
  const r=await invoke([user("PRODUIRE ABCDEF12")]);
  assert.equal(r.status,400);
  assert.match((await r.json()).message,/Storyboard/);
});
test("preflight blocks when current key budget is insufficient",async()=>{
  const r=await invoke([assistant(plan),user("PRODUIRE ABCDEF12")],mocks({limit:0.1}));
  assert.match((await r.json()).message,/Budget de clé insuffisant/);
});
test("quest strict blocks paid leakage when quest balance is missing",async()=>{
  const r=await invoke([assistant(plan),user("PRODUIRE ABCDEF12")],mocks({accountUsage:false}));
  assert.match((await r.json()).message,/solde Quest non visible/i);
});
test("preflight blocks restricted image keys",async()=>{
  const r=await invoke([assistant(plan),user("PRODUIRE ABCDEF12")],mocks({keyModels:["text","audio"]}));
  assert.match((await r.json()).message,/restriction de clé/);
});
test("preflight blocks unavailable MCP",async()=>{
  const r=await invoke([assistant(plan),user("PRODUIRE ABCDEF12")],mocks({toolAccess:false}));
  assert.match((await r.json()).message,/MCP ffmpeg inaccessible/);
});
test("preflight passes no tools executed",async()=>{
  const m=mocks();
  const r=await invoke([assistant(plan),user("PRODUIRE ABCDEF12")],m);
  assert.match((await r.json()).message,/PREFLIGHT_OK:ABCDEF12/);
  assert.equal(m.getRuns(),0);
});
test("cannot confirm without preflight marker",async()=>{
  const r=await invoke([assistant(plan),user("CONFIRMER ABCDEF12")]);
  assert.equal(r.status,400);
  assert.match((await r.json()).message,/confirmation préalable/);
});
test("confirm after preflight exposes only guarded media tools",async()=>{
  const r=await invoke([assistant(plan),assistant(preflight),user("CONFIRMER ABCDEF12")]);
  assert.ok(r.tools.generateImage);
  assert.ok(r.tools.generateSpeech);
  assert.ok(r.tools.runFfmpeg);
  await assert.rejects(()=>r.tools.generateImage.execute({model:"prunaai/p-image-edit"}),/whitelist/);
  assert.deepEqual(await r.tools.generateImage.execute({model:"black-forest-labs/flux.1-schnell"}),{ok:true});
});
test("invalid approval token doesn't launch tools",async()=>{
  const r=await invoke([assistant(plan),assistant(preflight),user("CONFIRMER 00000000")]);
  assert.equal(r.status,400);
});
test("model ID required for billable image calls",async()=>{
  const r=await invoke([assistant(plan),assistant(preflight),user("CONFIRMER ABCDEF12")]);
  await assert.rejects(()=>r.tools.generateImage.execute({prompt:"hello"}),/identifiant de modèle/);
});
test("max call limit guards repeat billable tool calls",async()=>{
  const r=await invoke([assistant(plan),assistant(preflight),user("CONFIRMER ABCDEF12")]);
  for(let i=0;i<13;i++) await r.tools.runFfmpeg.execute({});
  await assert.rejects(()=>r.tools.runFfmpeg.execute({}),/Plafond/);
});
