#!/usr/bin/env python3
"""Private cached Artificial Analysis metadata. NEVER publish raw Free API data.
Use: AA_API_KEY injected from IACA Secret Broker; python3 scripts/aa_cache_refresh.py
Only a trusted scheduler invokes this; public Story Animator users never call AA.
"""
import argparse,fcntl,hashlib,json,os,subprocess,sys,tempfile,time
from datetime import datetime,timezone,timedelta
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError

BASE="https://artificialanalysis.ai/api/v2"
ENDPOINTS={
 "llm":"/language/models/free",
 "t2i":"/media/text-to-image/models/free",
 "i2i":"/media/image-editing/models/free",
 "tts":"/media/text-to-speech/models/free",
 "stt":"/media/speech-to-text/models/free",
 "t2v":"/media/text-to-video/models/free",
 "i2v":"/media/image-to-video/models/free",
 "i2v_audio":"/media/image-to-video-audio/models/free",
 "s2s":"/media/speech-to-speech/models/free"}
DIR=Path.home()/".local/share/story-animator/aa-cache-private"
TTL=6; LOCAL_MAX=52; REMOTE_FLOOR=15

def now():return datetime.now(timezone.utc)
def stamp(t=None):return (t or now()).isoformat(timespec="seconds").replace("+00:00","Z")
def dt(t):
 try:return datetime.fromisoformat(t.replace("Z","+00:00"))
 except (ValueError,AttributeError,TypeError):return None
def read(p,default):
 try:return json.loads(Path(p).read_text())
 except (OSError,ValueError):return default
def write(p,obj):
 p=Path(p);p.parent.mkdir(parents=True,exist_ok=True,mode=0o700);os.chmod(p.parent,0o700)
 fd,tmp=tempfile.mkstemp(dir=p.parent,prefix="."+p.name+".")
 try:
  os.fchmod(fd,0o600)
  with os.fdopen(fd,"w") as f:json.dump(obj,f,ensure_ascii=False,indent=2);f.write("\n")
  os.replace(tmp,p);os.chmod(p,0o600)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)
def quota(state):
 reset=dt(state.get("reset"));remain=state.get("remaining")
 if reset and reset>now() and isinstance(remain,int) and remain<=REMOTE_FLOOR:return False
 calls=[v for v in state.get("calls",[]) if dt(v) and dt(v)>now()-timedelta(hours=24)]
 state["calls"]=calls
 return len(calls)<LOCAL_MAX
def headers_quota(headers,state):
 try:state["remaining"]=int(headers.get("X-RateLimit-Remaining"))
 except (ValueError,TypeError):pass
 try:state["reset"]=stamp(datetime.fromtimestamp(int(headers.get("X-RateLimit-Reset")),timezone.utc))
 except (ValueError,TypeError):pass
def collect(path,key,state):
 req=Request(BASE+path,headers={"x-api-key":key,"Accept":"application/json","User-Agent":"story-animator-private-AA-cache/0.3"})
 for attempt in range(2):
  try:
   with urlopen(req,timeout=18) as r:
    body=r.read(15000001)
    if len(body)>15000000:raise ValueError("Oversized response")
    data=json.loads(body)
    if not isinstance(data,dict) or not isinstance(data.get("data"),list):raise ValueError("Invalid envelope")
    headers_quota(r.headers,state);state.setdefault("calls",[]).append(stamp());return data,"ok"
  except HTTPError as e:
   headers_quota(e.headers,state);state.setdefault("calls",[]).append(stamp())
   if e.code==429:return None,"rate_limited"
   if e.code in (401,403):return None,"auth_or_tier_"+str(e.code)
   if e.code>=500 and attempt==0:time.sleep(2);continue
   return None,"http_"+str(e.code)
  except (URLError,TimeoutError,ValueError,OSError,json.JSONDecodeError):
   if attempt==0:time.sleep(2);continue
   return None,"unavailable_or_invalid"
 return None,"failed"

def github_private_verified(repo):
 """Fail closed: GitHub REST must affirm that the remote repo is PRIVATE."""
 import re
 from urllib.parse import urlparse
 remote=subprocess.run(["git","remote","get-url","origin"],cwd=repo,
                       capture_output=True,text=True,timeout=8)
 if remote.returncode:return False
 url=remote.stdout.strip()
 match=re.fullmatch(r"(?:https://github\.com/|git@github\.com:)([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+?)(?:\.git)?",url)
 if not match:return False
 slug=match.group(1)
 # Never push AA data into the public source repository.
 if slug.lower() in ("fkom13/story-animator-pollinations","tatine13/story-animator-pollinations"):
  return False
 cred=subprocess.run(["git","credential","fill"],input="protocol=https\nhost=github.com\n\n",
                     capture_output=True,text=True,timeout=9)
 if cred.returncode:return False
 props=dict(v.split("=",1) for v in cred.stdout.splitlines() if "=" in v)
 token=props.get("password")
 if not token:return False
 request=Request("https://api.github.com/repos/"+slug,
   headers={"Authorization":"Bearer "+token,"Accept":"application/vnd.github+json",
            "User-Agent":"StoryAnimatorPrivateCache"})
 try:
  with urlopen(request,timeout=12) as resp:
   obj=json.load(resp)
   return resp.status==200 and obj.get("private") is True and obj.get("full_name","").lower()==slug.lower()
 except (HTTPError,URLError,ValueError,OSError):
  return False

def sync_private(repo,cache,updated,manifest):
 if not repo:return "not_configured"
 repo=Path(repo).expanduser().resolve()
 # Must be an explicitly configured private repo, never the public source repo.
 if not (repo/".git").exists() or not (repo/".aa-private-only").exists():return "private_repo_not_prepared"
 if not github_private_verified(repo):return "remote_not_verified_private"
 target=repo/"snapshots";target.mkdir(parents=True,exist_ok=True)
 for name in updated:
  dest=target/(name+".json");dest.write_bytes((cache/(name+".json")).read_bytes());os.chmod(dest,0o600)
 write(repo/"manifest.json",manifest)
 env={**os.environ,"GIT_TERMINAL_PROMPT":"0"}
 try:
  subprocess.run(["git","add","snapshots","manifest.json"],cwd=repo,env=env,capture_output=True,check=True,timeout=30)
  check=subprocess.run(["git","diff","--cached","--quiet"],cwd=repo,env=env,timeout=15)
  if check.returncode==0:return "unchanged"
  subprocess.run(["git","commit","-qm","Private AA benchmarks "+stamp()],cwd=repo,env=env,check=True,capture_output=True,timeout=30)
  subprocess.run(["git","push","origin","HEAD"],cwd=repo,env=env,check=True,capture_output=True,timeout=45)
  return "private_git_pushed"
 except (subprocess.CalledProcessError,subprocess.TimeoutExpired):return "private_git_sync_failed"

def refresh(cache,key,ttl=TTL,private=None):
 cache.mkdir(parents=True,exist_ok=True,mode=0o700);os.chmod(cache,0o700)
 lock=cache/".writer.lock"
 with lock.open("a+") as lk:
  os.chmod(lock,0o600);fcntl.flock(lk,fcntl.LOCK_EX)
  state=read(cache/"quota.json",{})
  manifest=read(cache/"manifest.json",{"schema_version":1,"source":"Artificial Analysis","license":"internal-use-only","attribution":"https://artificialanalysis.ai/","categories":{}})
  updated=[];errors={}
  for name,path in ENDPOINTS.items():
   old=manifest["categories"].get(name,{})
   age=dt(old.get("updated_at"))
   if age and now()-age<timedelta(hours=ttl):continue
   if not quota(state):errors[name]="daily_quota_guard";continue
   data,status=collect(path,key,state)
   if status=="ok":
    at=stamp()
    write(cache/(name+".json"),{"retrieved_at":at,"source":BASE+path,"rights":"INTERNAL-ONLY","payload":data})
    digest=hashlib.sha256(json.dumps(data,sort_keys=True).encode()).hexdigest()
    manifest["categories"][name]={"updated_at":at,"count":len(data["data"]),"sha256":digest}
    updated.append(name)
   else:
    errors[name]=status
    if status in ("rate_limited","auth_or_tier_401","auth_or_tier_403"):break
  manifest["last_check_at"]=stamp()
  write(cache/"quota.json",state);write(cache/"manifest.json",manifest)
  git_status=sync_private(private,cache,updated,manifest) if updated else "no_changes"
  summary={"checked_at":stamp(),"categories_updated":updated,"errors":errors,
    "remaining":state.get("remaining"),"reset":state.get("reset"),"github_private":git_status}
  write(cache/"status.json",summary)
  return summary

def main():
 p=argparse.ArgumentParser()
 p.add_argument("--cache-dir",type=Path,default=DIR)
 p.add_argument("--private-git-dir",default=os.getenv("AA_PRIVATE_GIT_DIR"))
 p.add_argument("--ttl-hours",type=float,default=TTL)
 p.add_argument("--status",action="store_true")
 p.add_argument("--dry-run",action="store_true")
 a=p.parse_args()
 if a.dry_run:
  print(json.dumps({"endpoints":ENDPOINTS,"ttl_hours":a.ttl_hours,"max_calls_per_day":LOCAL_MAX,
    "estimated_calls_per_day":len(ENDPOINTS)*int(24/a.ttl_hours),
    "warning":"Free API internal-use only; never share raw dataset publicly."},indent=2));return 0
 if a.status:print(json.dumps(read(a.cache_dir/"status.json",{"status":"not_initialized"}),indent=2));return 0
 key=os.getenv("AA_API_KEY")
 if not key and os.getenv("AA_API_KEY_FILE"):
  path=Path(os.getenv("AA_API_KEY_FILE"))
  try:key=path.read_text(encoding="utf-8").strip()
  except OSError:key=None
 if not key:print('{"status":"secret_not_injected"}');return 2
 try:r=refresh(a.cache_dir,key,a.ttl_hours,a.private_git_dir)
 except Exception as e:
  print(json.dumps({"status":"failed","exception_type":type(e).__name__}));return 1
 print(json.dumps(r));return 3 if r["errors"] else 0
if __name__=="__main__":sys.exit(main())
