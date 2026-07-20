import { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION } from "@particle-network/universal-account-sdk";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync("./.env.local","utf8").split("\n").filter(l=>l.trim()&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const ua=new UniversalAccount({projectId:env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,projectClientKey:env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,projectAppUuid:env.NEXT_PUBLIC_PARTICLE_APP_ID,smartAccountOptions:{useEIP7702:true,name:"UNIVERSAL",version:UNIVERSAL_ACCOUNT_VERSION,ownerAddress:"0x9bA9442C6C2fa63978bAC7fA2bccE808443644EE"},tradeConfig:{slippageBps:100}});
try{
  await ua.createTransferTransaction({ token:{chainId:8453,address:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"}, amount:"1", receiver:"0x9bA9442C6C2fa63978bAC7fA2bccE808443644EE" });
}catch(e){
  console.log("message :", e.message);
  console.log("name    :", e.name);
  console.log("code    :", e.code);
  for (const k of Object.keys(e)) {
    if (["message","name","stack"].includes(k)) continue;
    let v = e[k];
    try { v = typeof v === "object" ? JSON.stringify(v).slice(0,600) : String(v); } catch { v = "[unserialisable]"; }
    console.log(`${k.padEnd(8)}:`, v);
  }
}
