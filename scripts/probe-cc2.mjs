import { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION, ZeroAddress } from "@particle-network/universal-account-sdk";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync("./.env.local","utf8").split("\n").filter(l=>l.trim()&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const owner="0x9bA9442C6C2fa63978bAC7fA2bccE808443644EE";
const ua=new UniversalAccount({projectId:env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,projectClientKey:env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,projectAppUuid:env.NEXT_PUBLIC_PARTICLE_APP_ID,smartAccountOptions:{useEIP7702:true,name:"UNIVERSAL",version:UNIVERSAL_ACCOUNT_VERSION,ownerAddress:owner},tradeConfig:{slippageBps:100}});
const N={1:"Ethereum",56:"BNB",8453:"Base",42161:"Arbitrum",101:"Solana"};
const USDC={8453:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",1:"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",42161:"0xaf88d065e77c8cC2239327C5EDb3A432268e5831"};
const cases=[
  ["USDC -> Base      0.5",  {chainId:8453,address:USDC[8453]}, "0.5"],
  ["USDC -> Base      1",    {chainId:8453,address:USDC[8453]}, "1"],
  ["USDC -> Base      2",    {chainId:8453,address:USDC[8453]}, "2"],
  ["USDC -> Ethereum  2",    {chainId:1,   address:USDC[1]},    "2"],
  ["ETH  -> Base      0.001",{chainId:8453,address:ZeroAddress},"0.001"],
  ["USDC -> Arbitrum  1  (control, same chain)", {chainId:42161,address:USDC[42161]}, "1"],
];
for(const [label,token,amount] of cases){
  try{
    const tx=await ua.createTransferTransaction({token,amount,receiver:owner});
    const from=[...new Set((tx.userOps??[]).map(o=>N[o.chainId]??o.chainId))];
    const cross=from.length>1||!from.includes(N[token.chainId]);
    console.log(`OK      ${label.padEnd(44)} userOps via [${from.join(", ")}]${cross?"   *** CROSS-CHAIN ***":""}`);
  }catch(e){ console.log(`FAILED  ${label.padEnd(44)} ${e.message?.slice(0,48)}`); }
}
