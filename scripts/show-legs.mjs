import { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION } from "@particle-network/universal-account-sdk";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync("./.env.local","utf8").split("\n").filter(l=>l.trim()&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const ua=new UniversalAccount({projectId:env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,projectClientKey:env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,projectAppUuid:env.NEXT_PUBLIC_PARTICLE_APP_ID,smartAccountOptions:{useEIP7702:true,name:"UNIVERSAL",version:UNIVERSAL_ACCOUNT_VERSION,ownerAddress:"0x9bA9442C6C2fa63978bAC7fA2bccE808443644EE"},tradeConfig:{slippageBps:100}});
const N={1:"Ethereum",56:"BNB",8453:"Base",42161:"Arbitrum",101:"Solana"};
const EXP={1:"etherscan.io",8453:"basescan.org",42161:"arbiscan.io",56:"bscscan.com"};
const list = await ua.getTransactions(1,3);
const items = Array.isArray(list) ? list : (list?.transactions ?? list?.list ?? list?.data ?? list?.records ?? []);
if (!Array.isArray(items)) { console.log("shape:", Object.keys(list||{})); process.exit(0); }
for (const t of items.slice(0,2)) {
  console.log(`\n=== ${t.tag}  ${t.createdAt}  status=${t.status} ===`);
  console.log(`   ${t.change?.amount} ${t.targetToken?.symbol}  from ${N[t.fromChains?.[0]]??t.fromChains} -> ${N[t.toChains?.[0]]??t.toChains}`);
  const d = await ua.getTransaction(t.transactionId);
  for (const g of ["depositUserOperations","settlementUserOperations","lendingUserOperations","refundUserOperations"]) {
    for (const op of (d[g]||[])) {
      if (op.txHash) console.log(`   ${g.replace("UserOperations","").padEnd(11)} ${String(N[op.chainId]??op.chainId).padEnd(9)} https://${EXP[op.chainId]}/tx/${op.txHash}`);
    }
  }
}
