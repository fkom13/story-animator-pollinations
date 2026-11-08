#!/usr/bin/env python3
"""Real Pollinations decision-model comparison. Uses authenticated Polli CLI; no API keys."""
import json, os, pathlib, re, subprocess, time, concurrent.futures, datetime, shutil, statistics
MODELS=[
"typesafe/jev-1.14",
"vllm-sr/d3",
"microsoft/microsoft-decision-1",
"respan/span-01-lite",
"openai/gpt-6-luna-decisions",
"jaredpalmer/kev-4b",
"perplexity/pplx-decider-v1.2",
"liquid/d1",
]
SCENARIOS=[
{
  "id":"scenario_writer_quest",
  "title":"Scénariste Medium — Corbeau/Renard Street, 60 secondes",
  "state":{
    "user_script":"Le Corbeau et le Renard revisité en humains, rue parisienne photoréaliste 2026. 60 secondes, dialogues, identité et vêtements constants. Medium (Quest only).",
    "stage":"screenplay and artistic director",
    "account_permissions":{"allowed":["A","B","C"],"denied":["D"],"quest_only":True},
    "criteria_weights":{"narrative_intelligence":0.30,"imagination":0.20,"character_consistency":0.20,"cost_efficiency":0.10,"reliability":0.10,"latency":0.10},
    "candidates":{
       "A":{"description":"Very creative literary model, slower, high cost", "narrative_intelligence":96,"imagination":95,"character_consistency":89,"cost_efficiency":35,"reliability":92,"latency":30,"quest":True,"tools":False},
       "B":{"description":"Strong reliable screenwriter with tool use", "narrative_intelligence":88,"imagination":87,"character_consistency":95,"cost_efficiency":85,"reliability":98,"latency":82,"quest":True,"tools":True},
       "C":{"description":"Small simple low-cost text model", "narrative_intelligence":72,"imagination":67,"character_consistency":71,"cost_efficiency":99,"reliability":99,"latency":98,"quest":True,"tools":True},
       "D":{"description":"Creative premium model, denied to key", "narrative_intelligence":99,"imagination":99,"character_consistency":99,"cost_efficiency":70,"reliability":99,"latency":95,"quest":False,"tools":True}
    }
  },
  "allowed":["A","B","C"],"expected":"B"
},
{
  "id":"t2i_pro_street",
  "title":"Génération image Pro — cohérence personnages et photo street",
  "state":{
    "user_script":"Film 60 secondes, personnages humains du Corbeau et Renard, photoréaliste street nuit pluvieuse, références cohérentes et expressions. Pro Quest+Paid autorisé. Première image déjà rejetée pour visage incohérent.",
    "stage":"text to image and character consistency",
    "account_permissions":{"allowed":["A","B","C"],"denied":["D"],"quest_only":False,"paid_models_allowed":True},
    "criteria_weights":{"photorealism":0.20,"identity_continuity":0.35,"artistic_direction":0.20,"cost_efficiency":0.10,"reliability":0.10,"latency":0.05},
    "candidates":{
       "A":{"description":"Beautiful cinematic image generator but weaker identity persistence","photorealism":97,"identity_continuity":69,"artistic_direction":96,"cost_efficiency":42,"reliability":96,"latency":60,"paid":True,"image_edit":False},
       "B":{"description":"Image edit supported, preserves subject identity from references","photorealism":92,"identity_continuity":98,"artistic_direction":90,"cost_efficiency":67,"reliability":98,"latency":76,"paid":True,"image_edit":True},
       "C":{"description":"Very cheap fast image generator but poor detail consistency","photorealism":75,"identity_continuity":60,"artistic_direction":67,"cost_efficiency":98,"reliability":99,"latency":98,"paid":False,"image_edit":True},
       "D":{"description":"Excellent model inaccessible with user key","photorealism":99,"identity_continuity":99,"artistic_direction":99,"cost_efficiency":95,"reliability":99,"latency":96,"paid":True,"image_edit":True}
    }
  },
  "allowed":["A","B","C"],"expected":"B"
}
]
# Third adversarial weighting case: in ECO, cost and speed should reverse the
# screenplay selection from the first scenario.
import copy
_ecocase=copy.deepcopy(SCENARIOS[0])
_ecocase["id"]="eco_cost_priority"
_ecocase["title"]="ECO screenplay: cost and latency dominate"
_ecocase["expected"]="C"
_ecocase["state"]["user_script"]=(
    "Quest-only ECO, simple 60-second educational narration, acceptable basic script quality. "
    "Cost efficiency and speed are paramount; no elaborate cinematic writing required.")
_ecocase["state"]["criteria_weights"]={
    "narrative_intelligence":0.10,"imagination":0.0,"character_consistency":0.05,
    "cost_efficiency":0.55,"reliability":0.15,"latency":0.15}
SCENARIOS.append(_ecocase)

# Fourth case uses ACTUAL Pollinations catalogue models and current indexed benchmarks
# (snapshot 2026-11-08; no assumption about next-day availability).
_live={
 "id":"live_writer_medium_20261108",
 "title":"Real Quest-capable models for cinematic screenplay, Nov 8 2026",
 "expected":"B",
 "allowed":["A","B","C","D"],
 "state":{
  "user_script":"Le Corbeau et le Renard reimagined as human street characters in Paris 2026; cinematic script 60s, dialogue, strong visual continuity; Medium Quest, no Paid.",
  "stage":"screenwriting with vision planning and narrative intelligence",
  "account_permissions":{"allowed":["A","B","C","D"],"quest_only":True},
  "criteria_weights":{"bench_index":0.40,"creative_prior":0.20,"cost_efficiency":0.15,"reliability":0.15,"latency":0.10},
  "candidates":{
   "A":{"id":"openai/gpt-6.1-terra","bench_index":77.6,"creative_prior":92,"cost_pollen_for_3000in_700out":0.004875,"cost_efficiency":10,"reliability":96.8,"latency_p50_ms":3480,"latency":80,"quest":True,"context":1050000,"tool_calling":True},
   "B":{"id":"deepseek/deepseek-v4.1-flash","bench_index":68,"creative_prior":84,"cost_pollen_for_3000in_700out":0.00087,"cost_efficiency":75,"reliability":99.44,"latency_p50_ms":5024,"latency":60,"quest":True,"context":1048576,"tool_calling":True},
   "C":{"id":"z-ai/glm-5.3-flash","bench_index":25,"creative_prior":79,"cost_pollen_for_3000in_700out":0.0008,"cost_efficiency":80,"reliability":99.93,"latency_p50_ms":3015,"latency":90,"quest":True,"context":1048576,"tool_calling":True},
   "D":{"id":"openai/gpt-6-luna","bench_index":32.8,"creative_prior":56,"cost_pollen_for_3000in_700out":0.0004875,"cost_efficiency":100,"reliability":99.51,"latency_p50_ms":3071,"latency":90,"quest":True,"context":1050000,"tool_calling":True}
  },
  "benchmark_source":"ArtificialWatch Bench Index 2026-11-08 15:55:35Z, CC BY 4.0",
  "data_notice":"All benchmark, reliability and tariff fields are live-snapshot observations. creative_prior and normalized efficiency/latency are transparent heuristic test values, not independently measured quality."
 }
}
SCENARIOS.append(_live)

# Same three candidate options for all models; no denied option in choice criteria.
def prompt_for(case,model):
    state=case["state"]
    if model=="respan/span-01-lite":
        # Respan works on plain-language string state + independent noul questions.
        # Structured objects and score/choice may be rejected by its upstream adapter.
        state=("Film task: "+case["title"]+". Story: "+state["user_script"]+". "
               +"Allowed candidates are A, B, C; candidate D is NOT authorized. "
               +"Weights: "+json.dumps(state["criteria_weights"])+". "
               +" Candidate details: "+json.dumps({k:state["candidates"][k] for k in case["allowed"]})+". "
               +"Use the weights to identify the best candidate.")
        questions={
           "suitability_A":{"type":"noul","instructions":"Candidate A is the best choice for this project under given weighted criteria and permissions."},
           "suitability_B":{"type":"noul","instructions":"Candidate B is the best choice for this project under given weighted criteria and permissions."},
           "suitability_C":{"type":"noul","instructions":"Candidate C is the best choice for this project under given weighted criteria and permissions."},
           **({"suitability_D":{"type":"noul","instructions":"Candidate D is the best choice for this project under given weighted criteria and permissions."}} if "D" in case["allowed"] else {})
        }
    else:
        options={k:"Candidate "+k+"; eligible, with attributes documented in state.candidates."+k for k in case["allowed"]}
        questions={"best":{"type":"choice","instructions":"Choose the BEST eligible candidate for this precise filmmaking task. Use the given numerical criteria_weights and candidates attribute scores. Do not select any denied candidate. If priorities conflict, obey the user's scenario and weighted criteria.","criteria":options},
        "selection_quality":{"type":"score","instructions":"How much does the chosen candidate meet the user's full task including artistic direction, price, permissions and reliability?","criteria":["Poor match","Acceptable match","Good match","Excellent match"]}}
    return json.dumps({"state":state,"questions":questions},ensure_ascii=False,separators=(",",":"))
CLI=os.path.expanduser("~/.local/bin/polli")
def parse_content(raw):
    raw=raw.strip()
    try:return json.loads(raw)
    except:pass
    # Some versions emit an explanation before JSON; don't fabricate an answer.
    m=re.search(r'\{[\s\S]*\}',raw)
    if m:
        try:return json.loads(m.group(0))
        except:pass
    return None
def one(case,model):
    inp=prompt_for(case,model)
    t=time.monotonic()
    argv=[CLI,"gen","text","--model",model,"--max-tokens","900","--no-stream",inp]
    try:
        pr=None
        for retry in range(3):
            pr=subprocess.run(argv,input="",capture_output=True,text=True,timeout=38)
            if pr.returncode==0 or not any(code in pr.stderr for code in ("401 Unauthorized","503 Service Unavailable")): break
            time.sleep(3+retry*2)
        elapsed=round(time.monotonic()-t,3)
        parsed=parse_content(pr.stdout)
        outcome={"scenario":case["id"],"model":model,"runtime_s":elapsed,"exit":pr.returncode,
                 "ok":pr.returncode==0 and isinstance(parsed,dict),
                 "response":parsed,"raw_output_excerpt":pr.stdout[:1500] if parsed is None else None,
                 "error":pr.stderr[-420:] if pr.returncode!=0 else None}
        if parsed:
            if "answers" in parsed and isinstance(parsed["answers"],dict):
                parsed=parsed["answers"]
            if model=="respan/span-01-lite":
                scores={}
                for cand in case["allowed"]:
                    entry=parsed.get("suitability_"+cand)
                    if isinstance(entry,dict):scores[cand]=entry.get("noul")
                scores={k:float(v) for k,v in scores.items() if isinstance(v,(int,float))}
                outcome["pick"]=max(scores,key=scores.get) if scores else None
                outcome["scores"]=scores
                outcome["confidence"]=scores.get(outcome["pick"])
            else:
                p=parsed.get("best") if isinstance(parsed,dict) else None
                outcome["pick"]=p.get("choice") if isinstance(p,dict) else None
                outcome["confidence"]=p.get("confidence") if isinstance(p,dict) else None
                outcome["probabilities"]=p.get("probabilities") if isinstance(p,dict) else None
                outcome["quality_score"]=parsed.get("selection_quality")
        outcome["eligible_pick"]=outcome.get("pick") in case["allowed"] if outcome.get("pick") else None
        outcome["matches_reference"]=outcome.get("pick")==case["expected"] if outcome.get("pick") else None
        return outcome
    except subprocess.TimeoutExpired:
        return {"scenario":case["id"],"model":model,"runtime_s":38,"exit":-1,"ok":False,"error":"TIMEOUT"}
def main():
    outdir=pathlib.Path("/tmp/story-decision-bench-20261108")
    outdir.mkdir(exist_ok=True)
    all_tasks=[(s,m) for s in SCENARIOS for m in MODELS]
    results=[]
    print("START",datetime.datetime.now().isoformat(),"TASKS",len(all_tasks),flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
        futs={ex.submit(one,s,m):(s["id"],m) for s,m in all_tasks}
        for f in concurrent.futures.as_completed(futs):
            row=f.result();results.append(row)
            print("RESULT",row["scenario"],row["model"],"OK",row.get("ok"),
                  "PICK",row.get("pick"),"CONF",row.get("confidence"),
                  "SEC",row.get("runtime_s"),"ERR",(row.get("error") or "")[:105].replace("\n"," "),flush=True)
            (outdir/"results_partial.json").write_text(json.dumps(results,indent=2,ensure_ascii=False))
    results.sort(key=lambda a:(a["scenario"],MODELS.index(a["model"])))
    full={"date":datetime.datetime.now().isoformat(),"benchmark":"Pollinations decision models, two fictional film-production routing cases",
          "method":"Polli CLI v1/chat/completions, identical structured questions, Span-01 Lite uses noul-only candidate checks",
          "scenarios":[{"id":x["id"],"title":x["title"],"expected":x["expected"],"weighting":x["state"]["criteria_weights"]} for x in SCENARIOS],
          "results":results}
    (outdir/"results.json").write_text(json.dumps(full,indent=2,ensure_ascii=False))
    print("DONE",sum(x.get("ok") for x in results),"OK OF",len(results),"PATH",outdir/"results.json",flush=True)
if __name__=="__main__":main()
