import { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION } from "@particle-network/universal-account-sdk";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync("./.env.local","utf8").split("\n").filter(l=>l.trim()&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const owner="0x9bA9442C6C2fa63978bAC7fA2bccE808443644EE";
const OTHER="0x6a0F8412D45165EB776bC36A6c204Fa4802318A8"; // the recipient wallet from the real payment
const ua=new UniversalAccount({projectId:env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,projectClientKey:env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,projectAppUuid:env.NEXT_PUBLIC_PARTICLE_APP_ID,smartAccountOptions:{useEIP7702:true,name:"UNIVERSAL",version:UNIVERSAL_ACCOUNT_VERSION,ownerAddress:owner},tradeConfig:{slippageBps:100}});
const N={1:"Ethereum",56:"BNB",8453:"Base",42161:"Arbitrum",101:"Solana"};

const show=(label,tx)=>{
  const chains=[...new Set((tx.userOps??[]).map(o=>N[o.chainId]??o.chainId))];
  console.log(`OK      ${label.padEnd(46)} via [${chains.join(", ")}]`);
};

// H1 — convert: "give me this asset on this chain", sourced from anywhere.
for (const [chainId,type,amount] of [[8453,"usdc","1"],[1,"usdc","2"],[8453,"eth","0.0005"],[42161,"usdc","1"]]) {
  const label=`convert -> ${amount} ${type} on ${N[chainId]}`;
  try { show(label, await ua.createConvertTransaction({ chainId, expectToken:{ type, amount } })); }
  catch(e){ console.log(`FAILED  ${label.padEnd(46)} ${e.message?.slice(0,42)}`); }
}

// H2 — cross-chain transfer to someone ELSE, not self.
for (const [chainId,address,amount,name] of [[8453,"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","1","Base"],[42161,"0xaf88d065e77c8cC2239327C5EDb3A432268e5831","1","Arbitrum"]]) {
  const label=`transfer to OTHER -> ${amount} USDC on ${name}`;
  try { show(label, await ua.createTransferTransaction({ token:{chainId,address}, amount, receiver: OTHER })); }
  catch(e){ console.log(`FAILED  ${label.padEnd(46)} ${e.message?.slice(0,42)}`); }
}
