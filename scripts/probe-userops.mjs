import { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION } from "@particle-network/universal-account-sdk";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync("./.env.local","utf8").split("\n").filter(l=>l.trim()&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const ua=new UniversalAccount({projectId:env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,projectClientKey:env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,projectAppUuid:env.NEXT_PUBLIC_PARTICLE_APP_ID,smartAccountOptions:{useEIP7702:true,name:"UNIVERSAL",version:UNIVERSAL_ACCOUNT_VERSION,ownerAddress:"0x9bA9442C6C2fa63978bAC7fA2bccE808443644EE"},tradeConfig:{slippageBps:100}});
const N={1:"Ethereum",56:"BNB",8453:"Base",42161:"Arbitrum",101:"Solana"};
const tx = await ua.createConvertTransaction({ chainId:8453, expectToken:{ type:"usdc", amount:"1" } });
console.log("rootHash:", tx.rootHash);
console.log("userOps:", tx.userOps?.length, "\n");
for (const op of tx.userOps ?? []) {
  console.log(`chain ${String(N[op.chainId] ?? op.chainId).padEnd(9)} delegated=${op.eip7702Delegated}  auth=${op.eip7702Auth ? JSON.stringify(op.eip7702Auth) : "NONE"}`);
}
