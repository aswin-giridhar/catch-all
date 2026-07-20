import { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION, ZeroAddress } from "@particle-network/universal-account-sdk";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync("./.env.local","utf8").split("\n").filter(l=>l.trim()&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const owner = "0x9bA9442C6C2fa63978bAC7fA2bccE808443644EE";
const ua = new UniversalAccount({ projectId: env.NEXT_PUBLIC_PARTICLE_PROJECT_ID, projectClientKey: env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY, projectAppUuid: env.NEXT_PUBLIC_PARTICLE_APP_ID, smartAccountOptions:{ useEIP7702:true, name:"UNIVERSAL", version:UNIVERSAL_ACCOUNT_VERSION, ownerAddress:owner }, tradeConfig:{ slippageBps:100 }});
const NAMES={1:"Ethereum",56:"BNB",8453:"Base",42161:"Arbitrum"};
const ETH=(c)=>({chainId:c,address:ZeroAddress});
const USDC_ARB={chainId:42161,address:"0xaf88d065e77c8cC2239327C5EDb3A432268e5831"};
const cases=[
  ["ETH->Base   0.0001", ETH(8453),"0.0001"],
  ["ETH->Base   0.0005", ETH(8453),"0.0005"],
  ["ETH->Base   0.002",  ETH(8453),"0.002"],
  ["ETH->Eth    0.0005", ETH(1),   "0.0005"],
  ["USDC->Arb   0.1",    USDC_ARB, "0.1"],
  ["USDC->Arb   1",      USDC_ARB, "1"],
  ["ETH->Arb    0.004",  ETH(42161),"0.004"],
  ["ETH->Arb    0.0055", ETH(42161),"0.0055"],
];
for (const [label, token, amount] of cases) {
  try {
    const tx = await ua.createTransferTransaction({ token, amount, receiver: owner });
    const chains=[...new Set((tx.userOps??[]).map(o=>NAMES[o.chainId]??o.chainId))];
    console.log(`OK      ${label.padEnd(22)} via [${chains.join(", ")}]`);
  } catch(e){ console.log(`FAILED  ${label.padEnd(22)} ${e.message?.slice(0,55)}`); }
}
