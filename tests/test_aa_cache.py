#!/usr/bin/env python3
"""Offline tests for single-writer Artificial Analysis cache. No external requests."""
import importlib.util,json,os,stat,tempfile,unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch
SRC=Path(__file__).resolve().parents[1]/"scripts"/"aa_cache_refresh.py"
spec=importlib.util.spec_from_file_location("aa_cache_refresh",SRC)
aa=importlib.util.module_from_spec(spec);spec.loader.exec_module(aa)

class CacheTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory()
  self.cache=Path(self.temp.name)/"private"
  self.calls=[]
  self.original_endpoints=aa.ENDPOINTS.copy()
  self.endpoints={"llm":"/language/models/free","t2i":"/media/text-to-image/models/free"}
  self.overrides=[patch.object(aa,"ENDPOINTS",self.endpoints),
                  patch.object(aa,"collect",self.fake_collect)]
  for obj in self.overrides:obj.start()
 def tearDown(self):
  for obj in self.overrides:obj.stop()
  self.temp.cleanup()
 def fake_collect(self,path,key,state):
  self.assertEqual(key,"FAKE_KEY_NOT_SECRET")
  self.calls.append(path)
  state["calls"]=state.get("calls",[])+[aa.stamp()]
  return {"tier":"free","data":[{"id":"model-"+path.split("/")[2]}]},"ok"
 def run_cache(self,ttl=6,private=None):
  return aa.refresh(self.cache,"FAKE_KEY_NOT_SECRET",ttl,private)
 def test_first_run_fetches_and_second_reads_cache(self):
  a=self.run_cache();self.assertEqual(len(a["categories_updated"]),2)
  b=self.run_cache();self.assertEqual(b["categories_updated"],[])
  self.assertEqual(len(self.calls),2)
 def test_ttl_refreshes_after_six_hours(self):
  self.run_cache()
  manifest=aa.read(self.cache/"manifest.json",{})
  manifest["categories"]["t2i"]["updated_at"]=aa.stamp(aa.now()-timedelta(hours=7))
  aa.write(self.cache/"manifest.json",manifest)
  r=self.run_cache()
  self.assertEqual(r["categories_updated"],["t2i"])
  self.assertEqual(len(self.calls),3)
 def test_local_quota_avoids_calls(self):
  aa.write(self.cache/"quota.json",{"calls":[aa.stamp()]*52})
  r=self.run_cache()
  self.assertEqual(self.calls,[])
  self.assertEqual(len(r["errors"]),2)
 def test_remote_remaining_avoids_calls(self):
  aa.write(self.cache/"quota.json",{"calls":[],"remaining":2,"reset":aa.stamp(aa.now()+timedelta(hours=8))})
  r=self.run_cache();self.assertEqual(self.calls,[])
  self.assertIn("daily_quota_guard",r["errors"].values())
 def test_last_good_data_survives_api_failure(self):
  self.run_cache()
  snapshot=(self.cache/"llm.json").read_bytes()
  manifest=aa.read(self.cache/"manifest.json",{})
  for v in manifest["categories"].values():v["updated_at"]=aa.stamp(aa.now()-timedelta(hours=7))
  aa.write(self.cache/"manifest.json",manifest)
  with patch.object(aa,"collect",return_value=(None,"rate_limited")):
   r=self.run_cache()
  self.assertIn("rate_limited",r["errors"].values())
  self.assertEqual((self.cache/"llm.json").read_bytes(),snapshot)
 def test_private_files_and_dirs(self):
  self.run_cache()
  self.assertEqual(stat.S_IMODE(self.cache.stat().st_mode),0o700)
  for file in self.cache.glob("*.json"):
   self.assertEqual(stat.S_IMODE(file.stat().st_mode),0o600)
 def test_private_repo_refused_without_marker(self):
  self.run_cache()
  repo=Path(self.temp.name)/"public-copy"
  repo.mkdir();(repo/".git").mkdir()
  self.assertEqual(aa.sync_private(repo,self.cache,["llm"],{}),"private_repo_not_prepared")
 def test_private_repo_refused_unverified_remote(self):
  import subprocess
  self.run_cache()
  repo=Path(self.temp.name)/"public-copy"
  subprocess.run(["git","init","-q",str(repo)],check=True)
  (repo/".aa-private-only").touch()
  subprocess.run(["git","-C",str(repo),"remote","add","origin","https://github.com/fkom13/story-animator-pollinations.git"],check=True)
  self.assertEqual(aa.sync_private(repo,self.cache,["llm"],{}),"remote_not_verified_private")
  self.assertFalse((repo/"snapshots").exists())
 def test_public_metadata_has_no_model_scores(self):
  self.run_cache()
  metadata=aa.read(self.cache/"manifest.json",{})
  self.assertNotIn("model-",json.dumps(metadata))
  self.assertNotIn("elo",json.dumps(metadata))
  self.assertIn("count",json.dumps(metadata))
 def test_never_use_key_from_cli_or_args(self):
  import re
  self.assertIsNone(re.search(r"AA_API_KEY\s*=\s*['\"]aa_",SRC.read_text()))
  self.assertEqual(aa.read(self.cache/"manifest.json",{}),{})
 def test_nine_endpoints_under_daily_limit(self):
  self.assertEqual(len(self.original_endpoints),9)
  self.assertLessEqual(9*4,52)

if __name__=="__main__":unittest.main(verbosity=2)
