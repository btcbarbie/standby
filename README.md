# Standby

**Say exactly what you want. It waits. Two checks decide.**

Standby lets an AI agent buy something for you while you're away (the concert ticket that drops under $40, the sold-out dress back in your size), but money only moves when independent checks agree.

> Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/). Runs on the PayPal sandbox with test money only.

## How it works

1. **Point and say.** Paste the link to the exact item or event and say what you want in plain words. Claude turns it into a checklist you confirm. The item is locked using the page's own product data, not the AI's reading of it.
2. **Approve one PayPal hold.** PayPal authorizes the most this watch may spend (Orders v2, `intent: AUTHORIZE`). Nothing is taken yet.
3. **Two yeses, or it waits.** When a new offer appears, three checks run independently:
   - **Scout** (AI) reads the page and says whether the offer matches your words.
   - **Banker** (a second AI with a different job) reviews the same offer *without* seeing Scout's answer, and flags tricks such as instructions hidden in a listing.

   Scout runs on **Google Gemini** and the Banker on **Anthropic Claude**, so the two AIs come from different companies with different blind spots: no single AI company can move your money. (Without a Gemini key, Scout falls back to Claude and each decision records which model answered.)
   - **Vault** (plain code) checks the numbers: same item, seller, quantity, total with fees, inside the PayPal hold, deadline, one purchase per watch, speed limit and daily limit.

   Vault says no: blocked. Scout and Banker both yes: Standby captures the actual amount from the hold (never more). Both no: skipped. Anything else: it waits for you.

Every decision is recorded and sealed to the one before it (a hash chain), so later edits are detectable.

In the language of Google's [Agent Payments Protocol (AP2)](https://ap2-protocol.org/), a watch is an **intent mandate** for a human-not-present purchase: the owner's own words, the confirmed checklist and hard limits, set up before the agent acts. Standby's addition is how the mandate is enforced: dual consensus between two independent AI checks, with code limits underneath and the owner as tie-breaker.

## Guardrails for the store

Stores block bots that roam and hammer their pages. A Standby agent is built to be welcome:

- **One page.** It visits only the link it was given. It never follows links, searches or visits other sites.
- **A polite pace and a visit limit.** Demo stores allow a visit every 10 seconds so you can watch; real stores would get one every 5 minutes. Each round has a visit allowance.
- **Says who it is, and proves it.** Every visit carries a plain declaration (one customer, at most one item, until a date, at what pace) and is signed with [Web Bot Auth](https://blog.cloudflare.com/web-bot-auth) (HTTP Message Signatures, an IETF draft), using Cloudflare's open-source [`web-bot-auth`](https://www.npmjs.com/package/web-bot-auth) library. The declaration is covered by the signature. Standby publishes its public key at `/.well-known/http-message-signatures-directory`, and the demo stores check every visit against it.
- **Follows the store's rules.** Each store publishes rules for AI agents (welcome, slow down, or closed). The agent slows down, or pauses and releases the hold, when asked, and waits when a store answers "too many requests".
- **Stops on time.** At the deadline or the visit limit, the watch pauses and the PayPal hold is released. The owner can reactivate it with a new hold.

The demo stores include a store owner's view: every AI agent on the page, its visits, what it declared, and whether its signature checked out. A "copycat bot" button shows a visit that claims to be Standby but edited its declaration, which fails verification.

## Demo stores (and what you can try)

The agents watch two practice websites served by the same app: **Tixora** (resale tickets) and **Wren** (clothing). Each visitor gets their own copy. A demo panel on each store lists new tickets or restocks sizes, including a listing with hidden instructions aimed at AI shoppers.

## Run locally

```bash
npm install
cp .env.example .env   # add your keys
npx prisma db push
npm run dev            # http://localhost:3300
```

## Tech

Next.js 16, Prisma + SQLite, Gemini 3.8 Flash via `@google/genai` (Scout), Claude Opus 5.5 via the Anthropic API (Banker and setup) (structured outputs, server-side refusal fallback), PayPal Orders v2 and Payments v2 (authorize, capture, void) in the sandbox, and Cloudflare's `web-bot-auth` for signed agent visits.

## License

MIT
