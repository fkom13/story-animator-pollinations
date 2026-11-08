import fs from "node:fs/promises";
import {execFileSync} from "node:child_process";
import path from "node:path";
const root=path.resolve(new URL("..",import.meta.url).pathname);
const src=await fs.readFile(path.join(root,"agent.v02.ts"),"utf8");
const mod=await import("data:text/javascript;base64,"+Buffer.from(src+"\nexport {shotPreset,finalPreset,shotPlan};").toString("base64"));
const imgs=[1,2,3,1].map(i=>path.join(root,"pilots/beep7/scene_"+i+".jpg"));
const segments=[
 {n:0,duration:2,motion:"push-in",spoken:""},
 {n:1,duration:1.5,motion:"pan-left",spoken:""},
 {n:2,duration:0.6,motion:"pull-back",spoken:""},
 {n:3,duration:0.9,motion:"diagonal",spoken:""}
];
function run(args,output,expected,kind){
 const cmd=args.args.map((x,i,a)=>i>0 && a[i-1]==="-i" && x.startsWith("input")?imgs[Number(x.slice(5))]:x);
 execFileSync("ffmpeg",["-hide_banner","-loglevel","error","-y",...cmd,output],{timeout:80000,stdio:"pipe",cwd:root});
 const prob=JSON.parse(execFileSync("ffprobe",["-v","error","-show_entries","format=duration,size:stream=codec_type,width,height","-of","json",output],{encoding:"utf8"}));
 const d=Number(prob.format.duration);
 if(Math.abs(d-expected)>.07)throw Error(kind+" bad duration "+d+" expected "+expected);
 console.log(kind,"DURATION",d,"STREAMS",prob.streams.map(s=>s.codec_type).join(","),"FILE",output);
}
const preset=mod.shotPreset(segments,imgs.map((_,i)=>"https://media.pollinations.ai/"+i),"16:9");
run(preset,"/tmp/story_media_segment.mp4",5,"MULTI_SHOT");
const script={beats:[{spoken:"La première scène"},{spoken:"Le piège se referme"},{spoken:"La fin arrive"}]};
const fin=mod.finalPreset(["https://media.pollinations.ai/abc"],"https://media.pollinations.ai/def",5,script,true);
console.log("FINAL_SHAPE",JSON.stringify({argsCount:fin.args.length,filterLength:fin.args[fin.args.indexOf("-filter_complex")+1].length,captionsIncluded:fin.captionsIncluded}));
const files=["/tmp/story_media_segment.mp4","/tmp/story_media_segment.mp4","/tmp/story_media_segment.mp4",path.join(root,"pilots/beep7/narration.mp3")];
const finalArgs=mod.finalPreset(["https://media.pollinations.ai/a","https://media.pollinations.ai/b","https://media.pollinations.ai/c"],"https://media.pollinations.ai/d",15,script,true);
const realArgs=finalArgs.args.map((s,i,a)=>i>0&&a[i-1]==="-i"&&s.startsWith("input")?files[Number(s.slice(5))]:s);
execFileSync("ffmpeg",["-hide_banner","-loglevel","error","-y",...realArgs,"/tmp/story_media_final_15s.mp4"],{timeout:80000,stdio:"pipe"});
const probe=JSON.parse(execFileSync("ffprobe",["-v","error","-show_entries","format=duration:stream=codec_type","-of","json","/tmp/story_media_final_15s.mp4"],{encoding:"utf8"}));
if(Math.abs(Number(probe.format.duration)-15)>0.08)throw Error("Final montage duration incorrect");
if(!probe.streams.some(v=>v.codec_type==="audio"))throw Error("Final montage missing audio");
console.log("FULL_LOCAL_FFMPEG_FINAL",probe.format.duration,"AUDIO",probe.streams.map(v=>v.codec_type).join(","),"CAPTIONS",finalArgs.captionsIncluded);
