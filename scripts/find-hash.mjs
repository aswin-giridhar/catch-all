import { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION } from "@particle-network/universal-account-sdk";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync("./.env.local","utf8").split("\n").filter(l=>l.trim()&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const owner = "0x9bA9442C6C2fa63978bAC7fA2bccE808443644EE";
const ua = new UniversalAccount({ projectId: env.NEXT_PUBLIC_PARTICLE_PROJECT_ID, projectClientKey: env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY, projectAppUuid: env.NEXT_PUBLIC_PARTICLE_APP_ID, smartAccountOptions:{ useEIP7702:true, name:"UNIVERSAL", version:UNIVERSAL_ACCOUNT_VERSION, ownerAddress:owner }, tradeConfig:{ slippageBps:100 }});
const detail = await ua.getTransaction("0x0657013162e1e3");
const json = JSON.stringify(detail);
// Any 32-byte hex string is a candidate on-chain hash.
const hashes = [...new Set(json.match(/0x[0-9a-fA-F]{64}/g) || [])];
console.log("keys:", Object.keys(detail || {}).join(", "));
console.log("\n32-byte hashes found:");
hashes.forEach(h => console.log("  " + h));
