import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const src=await fs.readFile(new URL("../agent.ts",import.meta.url),"utf8");
const {decideRoutes,decisionChain,applyDecisionRoutes,makeDecisionProblem,decisionDescription}=
  await import("data:text/javascript;base64,"+Buffer.from(src+
   "\nexport {decideRoutes,decisionChain,applyDecisionRoutes,makeDecisionProblem,decisionDescription};").toString("base64"));
const D3="vllm-sr/d3",JEV="typesafe/jev-1.14",MS="microsoft/microsoft-decision-1";
const DECISIONS=[D3,JEV,MS].map(id=>({
 id,paid_only:id===JEV,
 supported_endpoints:["/alpha/decisions","/v1/chat/completions"],
 health:{status:"healthy"},input_modalities:["text"],output_modalities:["text"]
}));
const firstRole=[
 {id:"writer/high-quality",score:0.82,paid:false,price:0.0009,health:"healthy",success:0.99,latency:3000,benchIndex:78},
 {id:"writer/consistent",score:0.81,paid:false,price:0.0004,health:"healthy",success:0.99,latency:2000,benchIndex:72}
];
const images=[
 {id:"image/cinematic",score:0.8,paid:false,price:0.002,health:"healthy",success:0.99,latency:4000},
 {id:"image/characters",score:0.7,paid:false,price:0.003,health:"healthy",success:0.98,latency:3000}
];
const brief=(tier="pro")=>({idea:"Le Corbeau et le Renard humains photoréalistes 2026, street, 60 secondes",tier,style:"cinematic",aspect:"16:9",duration:60});
function context({tier="pro",questOnly=false,permit=["*"],missing=[],down=[]}={}){
 const models=DECISIONS.filter(m=>!missing.includes(m.id)).map(m=>({...m,health:{status:down.includes(m.id)?"down":"healthy"}}));
 return {models,key:{valid:true,questPollenOnly:questOnly,permissions:{models:permit}},
  ranks:{writer:firstRole.map(m=>({...m})),t2i:images.map(m=>({...m}))}};
}
function responder({fails=[],wrongChoice=[],calls=[],failType=402}={}){
 return async(path,opts)=>{
  assert.equal(path,"/v1/chat/completions");
  const req=JSON.parse(opts.body),model=req.model;
  calls.push(model);
  if(fails.includes(model))return Response.json({error:"Not allowed"},{status:failType});
  const typed=JSON.parse(req.messages.at(-1).content);
  assert.match(typed.state.histoire,/Corbeau/);
  assert.equal(typed.state.ponderations.writer.qualite,typed.state.qualite==="pro"?.73:typed.state.qualite==="medium"?.58:.34);
  assert.equal(typed.state.candidats.writer[0].id,"writer/high-quality");
  assert.equal(typed.state.candidats.t2i[1].id,"image/characters");
  assert.deepEqual(Object.keys(typed.questions).sort(),["best_t2i","best_writer"]);
  const data={};
  for(const role of ["writer","t2i"]){
   data["best_"+role]={type:"choice",
     choice:wrongChoice.includes(model)?"D":role==="writer"?"B":"A",
     confidence:.83,probabilities:{A:.17,B:.83}};
  }
  return Response.json({choices:[{message:{content:JSON.stringify(data)}}]});
 };
}
test("order: Free D3, Paid JEV, Quest Microsoft, final JS in PRO with paid key",()=>{
 const x=context();
 assert.deepEqual(decisionChain(x,brief()).map(m=>m.id),[D3,JEV,MS]);
 assert.match(decisionDescription(null,decisionChain(x,brief())),/final 4. JavaScript/);
});
test("Quest-only ECO/MEDIUM: D3 then Microsoft then JavaScript, never Paid JEV",()=>{
 for(const tier of ["eco","medium"]){
  const x=context({questOnly:false});
  assert.deepEqual(decisionChain(x,brief(tier)).map(m=>m.id),[D3,MS]);
  assert.match(decisionDescription(null,decisionChain(x,brief(tier))),/final 3. JavaScript/);
 }
});
test("Quest-only key also removes Paid JEV even in Pro",()=>{
 assert.deepEqual(decisionChain(context({questOnly:true}),brief()).map(m=>m.id),[D3,MS]);
});
test("user key restriction and catalog health block Paid JEV",()=>{
 assert.deepEqual(decisionChain(context({permit:[D3,MS]}),brief()).map(m=>m.id),[D3,MS]);
 assert.deepEqual(decisionChain(context({down:[JEV]}),brief()).map(m=>m.id),[D3,MS]);
 assert.deepEqual(decisionChain(context({missing:[JEV]}),brief()).map(m=>m.id),[D3,MS]);
});
test("D3 chooses primary for each role; fallback stays live and correctly JS-filtered",async()=>{
 const x=context(),calls=[];
 const d=await decideRoutes(responder({calls}),x,brief());
 assert.equal(d.engine,D3);assert.deepEqual(calls,[D3]);
 assert.equal(d.selection.writer,"writer/consistent");
 assert.equal(d.details.writer.confidence,.83);
 applyDecisionRoutes(x,d);
 assert.deepEqual(x.ranks.writer.map(v=>v.id),["writer/consistent","writer/high-quality"]);
});
test("D3 failure -> paid JEV on Pro when allowed",async()=>{
 const x=context(),calls=[];
 const d=await decideRoutes(responder({fails:[D3],calls}),x,brief());
 assert.equal(d.engine,JEV);assert.deepEqual(calls,[D3,JEV]);
 assert.equal(d.attempts[0].status.includes("échec"),true);
});
test("D3 and JEV failure -> Quest Microsoft",async()=>{
 const x=context(),calls=[];
 const d=await decideRoutes(responder({fails:[D3,JEV],calls}),x,brief());
 assert.equal(d.engine,MS,JSON.stringify(d.attempts));assert.deepEqual(calls,[D3,JEV,MS]);
});
test("Quest ECO D3 failure -> Microsoft; no paid spend",async()=>{
 const x=context(),calls=[];
 const d=await decideRoutes(responder({fails:[D3],calls}),x,brief("eco"));
 assert.equal(d.engine,MS,JSON.stringify(d.attempts));assert.deepEqual(calls,[D3,MS]);
});
test("all models fail -> deterministic JS with untouched rankings",async()=>{
 const x=context(),calls=[];
 const baseline=JSON.stringify(x.ranks);
 const d=await decideRoutes(responder({fails:[D3,JEV,MS],calls}),x,brief());
 assert.equal(d.engine,"javascript");assert.deepEqual(d.selection,{});
 assert.deepEqual(calls,[D3,JEV,MS]);
 applyDecisionRoutes(x,d);assert.equal(JSON.stringify(x.ranks),baseline);
});
test("unlisted or malicious model choice -> fallback, never unapproved result",async()=>{
 const x=context(),calls=[];
 const d=await decideRoutes(responder({wrongChoice:[D3],calls}),x,brief("medium"));
 assert.equal(d.engine,MS,JSON.stringify(d.attempts));assert.deepEqual(calls,[D3,MS]);
 assert.equal(d.selection.writer,"writer/consistent");
});
test("degraded or missing D3 → Paid JEV when Pro, then Microsoft if absent",()=>{
 assert.deepEqual(decisionChain(context({down:[D3]}),brief()).map(m=>m.id),[JEV,MS]);
 assert.deepEqual(decisionChain(context({missing:[D3,JEV]}),brief()).map(m=>m.id),[MS]);
});
test("decision request never contains raw API keys",async()=>{
 const x=context(),calls=[];
 x.key.secret="sk_super_private_should_not_leave_account";
 const request=async(path,opts)=>{
  assert.ok(!opts.body.includes(x.key.secret));
  return responder({calls})(path,opts);
 };
 const d=await decideRoutes(request,x,brief());
 assert.equal(d.engine,D3);
});
