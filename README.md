# Standby

**Say exactly what you want. It waits. Two checks decide.**

Standby lets an AI agent buy something for you while you're away (the concert ticket that drops under $40, the sold-out dress back in your size), but money only moves when independent checks agree.

> Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/). Runs on the PayPal sandbox with test money only.

## How it works

1. **Point and say.** Paste the link to the exact item or event and say what you want in plain words. Claude turns it into a checklist you confirm. The item is locked using the page's own product data, not the AI's reading of it.
2. **Approve one PayPal hold.** PayPal authorizes the most this watch may spend (Orders v2, `intent: AUTHORIZE`). Nothing is taken yet.
3. **Two yeses, or it waits.** When a new offer appears, three checks run independently:
   - **Scout** (AI) reads the page and says whether the offer matches your words.
   - **Banker** (a second AI call with a different job) reviews the same offer *without* seeing Scout's answer, and flags tricks such as instructions hidden in a listing.
   - **Vault** (plain code) checks the numbers: same item, seller, quantity, total with fees, inside the PayPal hold, deadline, one purchase per watch, speed limit and daily limit.

   Vault says no: blocked. Scout and Banker both yes: Standby captures the actual amount from the hold (never more). Both no: skipped. Anything else: it waits for you.

Every decision is recorded and sealed to the one before it (a hash chain), so later edits are detectable.

## Demo stores

The agents watch two practice websites served by the same app: **Tixora** (resale tickets) and **Wren** (clothing). Each visitor gets their own copy. A demo panel on each store lists new tickets or restocks sizes, including a listing with hidden instructions aimed at AI shoppers.

## Run locally

```bash
npm install
cp .env.example .env   # add your keys
npx prisma db push
npm run dev            # http://localhost:3300
```

## Tech

Next.js 16, Prisma + SQLite, Claude Opus 5.5 via the Anthropic API (structured outputs, server-side refusal fallback), PayPal Orders v2 and Payments v2 (authorize, capture, void) in the sandbox.

## License

MIT
