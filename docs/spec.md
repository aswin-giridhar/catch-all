# Catch-all — design spec

**One line:** An address that cannot be paid wrong. Any token, any chain in → always USDC on Arbitrum out.

## Why this exists

Sending crypto to the wrong chain is one of the most common ways ordinary people
permanently lose money. Every existing fix is a warning label. This removes the
failure mode structurally: the recipient's link accepts anything, and the recipient
always receives one predictable asset on one predictable chain.

Chain abstraction is usually sold as *convenience*. Here it is sold as *safety*.

## Technical constraints

- Universal Accounts SDK in EIP-7702 mode, so the user's existing EOA becomes the
  account rather than a new smart account being deployed alongside it
- Value must genuinely move across chains, not merely settle on one
- Arbitrum as the settlement chain: predictable, cheap, and fast enough that the
  recipient sees the money arrive within the span of a demo
- Magic embedded wallet, because EIP-7702 authorizations require a wallet that
  exposes `signAuthorization` — ordinary JSON-RPC wallets cannot participate
- Deployed and publicly reachable: https://uxmaxx-seven.vercel.app

## Two link types, one payment engine

| | Receive link | Paywall link |
|---|---|---|
| Path | `/r/<address>` | `/u/<address>` |
| Payer chooses amount | yes | no — fixed price |
| Payer gets | a receipt | the gated content |
| Recipient gets | USDC on Arbitrum | USDC on Arbitrum |

Both run the same `usePayment` engine. The paywall is the receive link plus a price
and a payload.

## No backend, deliberately

Link state lives in the URL. No database, no custody, no escrow, no smart contract.
This is the reason the concept is buildable in the time available — every rejected
alternative (time locks, undo windows, marketplace escrow) required holding funds
somewhere in between.

**Known limitation, stated honestly:** paywall content is base64-encoded in the URL,
so it is obfuscated rather than secret. A production build would gate it server-side
behind a payment check. The demo does not pretend otherwise.

## Screens

1. **Landing** — the pitch, one email field. No wallet language anywhere.
2. **Home** (signed in) — your link + QR, balance in USDC on Arbitrum, activity.
3. **Create paywall** — title, price, content → shareable link.
4. **Pay** (`/r/`, `/u/`) — who you're paying, amount, "pay from anything", fee preview.
5. **Receipt** — *sent from X on chain A → received USDC on Arbitrum*, Arbiscan link.

## The demo

Sender holds a non-USDC asset, or USDC on a non-Arbitrum chain. Recipient is a fresh
email with no wallet at all. One payment. Recipient receives USDC on Arbitrum.

The receipt is the money shot: it names what went in and what came out, and they are
different chains.

## Failure modes to handle explicitly

- Insufficient balance → show the fee preview *before* signing, never after
- Not yet delegated on Arbitrum → delegate inline, don't make it a separate user step
- Payer has no wallet → email login creates one mid-flow, no interruption
- Transaction pending → show progress; UA routing is not instant
