import fs from "node:fs";
import path from "node:path";
const cwd=path.resolve(import.meta.dirname,"..");
const files=["01-core.js","02-decision.js","02-story.js","03-media.js","04-agent.js"];
const merged=files.map(name=>fs.readFileSync(path.join(cwd,"src",name),"utf8")).join("\n")+"\n";
const target=path.join(cwd,"agent.ts");
if(process.argv.includes("--check")){
 const current=fs.existsSync(target)?fs.readFileSync(target,"utf8"):"";
 if(current!==merged){console.error("agent.ts is stale: run npm run build");process.exit(1)}
 console.log("Compiled Code Agent is up-to-date ("+Buffer.byteLength(merged)+" bytes).");
}else{
 fs.writeFileSync(target,merged);
 console.log("Built agent.ts from "+files.join(", "));
}
