import { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION } from "@particle-network/universal-account-sdk";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync("./.env.local","utf8").split("\n").filter(l=>l.trim()&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const ua = new UniversalAccount({ projectId: env.NEXT_PUBLIC_PARTICLE_PROJECT_ID, projectClientKey: env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY, projectAppUuid: env.NEXT_PUBLIC_PARTICLE_APP_ID, smartAccountOptions:{ useEIP7702:true, name:"UNIVERSAL", version:UNIVERSAL_ACCOUNT_VERSION, ownerAddress:"0x9bA9442C6C2fa63978bAC7fA2bccE808443644EE" }, tradeConfig:{ slippageBps:100 }});
const d = await ua.getTransaction("0x0657013162e1e3");
for (const key of ["depositUserOperations","settlementUserOperations","refundUserOperations","lendingUserOperations"]) {
  const arr = d[key];
  if (Array.isArray(arr) && arr.length) {
    console.log(`\n${key}[0] keys:`, Object.keys(arr[0]).join(", "));
    for (const [k,v] of Object.entries(arr[0])) {
      if (typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v)) console.log(`   ${k} = ${v}`);
      if (typeof v === "number" && k.toLowerCase().includes("chain")) console.log(`   ${k} = ${v}`);
    }
  }
}
