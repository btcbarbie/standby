# Standby

**Your AI shopper. Your rules. Your money.**

**You find it. Standby waits for the right moment to buy it.**

You give Standby the exact shopping link: the concert ticket that's sold out, the dress that isn't in your size, the price you're waiting for. Standby watches that page and acts when the right opportunity comes along, within the limits and requirements you set. Two independent AI checks review every purchase, and a hard-coded lock enforces your limits before PayPal moves any money.

**Live demo:** https://standby-production-dd56.up.railway.app (PayPal sandbox, test money only)

> Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/). Everything runs on the PayPal sandbox.

## Try it (for judges)

**1. Watch a decision happen (about a minute, nothing to set up).**
Open the live demo and click **Try the demo**. You land on a watch that's already running: *1 left-wing ticket under $40* on Tixora, a demo ticket store. The store then lists two seats on its own:

- a left-wing seat whose fees push it to $49: the Vault blocks it, no money moves;
- a left-wing seat at $38 with fees: Scout and the Banker both say yes, the Vault passes, and you get **Found it** with a **Pay $38 with PayPal** button.

Open the watch to see the whole conversation between Scout, the Banker and the Vault. The bell shows the alert.

**2. Let Standby buy by itself with a PayPal hold.**

1. Click **+ New watch**, tap **Wren · wrap dress**, then the suggestion **Green, size 8 back in stock**, then **Make the plan**.
2. Scout's plan fills in the budget from today's total ($64 + $6 shipping = $70). Keep **buy it for you** selected and click **Approve the hold with PayPal**.
3. Log in to PayPal with the sandbox buyer below and approve. Nothing is taken yet; PayPal only holds up to $70.
4. Back on the watch, open **Wren (clothing) ↗** from **Your watches**, and in the store's demo panel tap **Green / 8 back in stock**.
5. Within about a minute: Scout says yes, the Banker says yes, the Vault passes, and Standby captures $70 from the hold. The watch shows **Bought** with the PayPal capture ID, the bell lights up, and the purchase is listed under **Purchases**.

**Sandbox buyer (PayPal personal test account):**

- Email: `SANDBOX_BUYER_EMAIL`
- Password: `SANDBOX_BUYER_PASSWORD`

**3. Try the tricks.** On the Tixora store's demo panel, **$30 seat with a hidden message** lists a seat whose text tells AI shoppers to buy four and claims the owner already approved it. The Banker flags it, so Standby stops and asks you instead of paying.

**4. Point it at a real store.** Paste a product link from a store that publishes its product data, such as `https://www.allbirds.com/products/mens-tree-runners`. Scout shows the colours, sizes and what's sold out. Real stores are watch-and-alert only: Standby tells you, and you buy on the store's own checkout.

## How it works

1. **You find it.** Paste the link to the exact product or event. Scout reads the page's own product data and shows what it found: colours and sizes (sold-out ones marked), or the tickets on sale.
2. **Say what you want.** In plain words, or tap a suggestion built from that page: a sold-out size coming back, a lower price, a set time for a drop. Scout turns it into a plan you check in one sentence: the item, what must be true, the most you'll pay in total, how long to watch, and whether to tell you or buy it for you.
3. **Two yeses and the lock, or it waits.** When something new turns up:
   - **Scout** (AI, Google Gemini) proposes it if it matches your words.
   - **The Banker** (AI, Anthropic Claude) reviews the same offer against your original words *without* seeing Scout's answer, and flags tricks such as instructions hidden in a listing.
   - **The Vault** (hard-coded rules, not AI) checks the numbers: same item, the details you required, seller, quantity, total with fees, inside the PayPal hold, before the deadline, one purchase per watch, at most 3 buys per 10 minutes and $500 a day.

   Vault says no: blocked. Both AIs say yes and the Vault passes: PayPal is paid (or, in alert mode, you're told). Both AIs say no: skipped. The AIs disagree, or the Banker raises a red flag: it waits for you.

Because Scout and the Banker come from different AI companies, no single AI company can move your money, and a listing that fools one model has to fool another, trained differently, to get through. In testing, Gemini Scout fell for a listing with hidden instructions and Claude Banker caught it.

## What a watch can do

- **Catch a restock** of a sold-out size or colour, **wait for a price drop**, or **start at a set time** (Scout stays quiet until then).
- **Lock to details you require** on whatever the site shows for each listing: a section, a row, a seller, a size, a colour. Listings that don't match are skipped in code before any AI looks at them, and the Vault checks again before paying. Preferences with a fallback ("left wing if possible, otherwise any seat") are never turned into locks.
- **Tell you, or buy for you.** Alert mode: Standby tells you and you pay (on a demo store, you approve that one payment in PayPal). Buy mode: you approve one PayPal hold up front and Standby pays from it only when every check passes.
- **Point you to the store** when what you asked for is already on sale within your budget. Standby is for what you can't simply buy right now.
- **Keep a record.** Each watch has a conversation of everything Scout, the Banker, the Vault, PayPal and you said. Important moments (a purchase, a find, a question for you) also arrive as alerts. Every decision is sealed to the one before it (a hash chain), so later edits show. **Purchases** lists every buy with its PayPal capture ID.
- **Stop all** is an emergency brake: no visits and no purchases until you switch it back on.

In the language of Google's [Agent Payments Protocol (AP2)](https://ap2-protocol.org/), a watch is an **intent mandate** for a human-not-present purchase: your words, the confirmed checklist and hard limits, set up before the agent acts. Standby's addition is how the mandate is enforced: two independent AI checks from different companies, a hard-coded lock underneath, and you as the tie-breaker.

## How PayPal is used

- **Buy it for me:** Orders v2 with `intent: AUTHORIZE`. You approve a hold for the most the watch may spend. When every check passes, Standby captures the actual total from that authorization (never more) with `final_capture`, and the rest is released. Pausing, ending or reaching the deadline voids the hold.
- **Alert me (demo stores):** when all checks agree, you approve that one payment yourself (Orders v2, `intent: CAPTURE`).
- **Only stores that take PayPal:** Standby refuses to watch a page that doesn't offer PayPal as a way to pay.
- All payment calls send a `PayPal-Request-Id`, so a retried call can't pay twice.

## Guardrails for the store

Stores block bots that roam and hammer their pages. A Standby agent is built to be welcome:

- **One page.** It visits only the link it was given. It never follows links, searches or visits other sites.
- **A polite pace and a visit limit.** One visit every 5 minutes on real stores (every 10 seconds on the demo stores so you can watch), with a limit per round.
- **Says who it is, and proves it.** Every visit carries a plain declaration (one customer, at most one item, until a date, at what pace) and is signed with [Web Bot Auth](https://blog.cloudflare.com/web-bot-auth) (HTTP Message Signatures), using Cloudflare's open-source [`web-bot-auth`](https://www.npmjs.com/package/web-bot-auth) library. The public key is at `/.well-known/http-message-signatures-directory`, and the demo stores verify every visit against it.
- **Follows the store's rules.** It respects `robots.txt`, slows down or pauses when a store asks, and backs off on "too many requests".
- **Never gets around a "no".** If a store answers bots with a bot check (for example Walmart's "Robot or human?"), Standby says so and doesn't try to get past it.
- **Shows AI-checkout support.** If a store publishes an agent-checkout profile (`/.well-known/ucp`), the preview shows which payment methods its AI checkout takes.

The demo stores include a store owner's view of every AI agent that visited, what it declared, and whether its signature checked out. A **copycat bot** visit claims to be Standby but edited its declaration, and fails verification.

## AI and tools used

- **Google Gemini** (`gemini-3.8-flash`, with `gemini-3.6-flash` and Flash-Lite as fallbacks when it's busy) via `@google/genai`, structured JSON output: **Scout**, which judges each new offer.
- **Anthropic Claude** (Claude Opus 5.5) via the Anthropic API, structured outputs: **the Banker** (the blind second review) and **the setup step** (turning your words and the page into a plan, locks, a start time and a budget).
- Each decision records which model answered. Without a Gemini key, Scout falls back to Claude and says so.
- **PayPal** Orders v2 and Payments v2 (authorize, capture, void) in the sandbox.
- **Cloudflare `web-bot-auth`** for signed agent visits.
- Built with **Next.js 16**, React 19, Tailwind CSS 4, Prisma with SQLite, hosted on Railway.
- Claude Code was used as a coding assistant.

## Limits, honestly

- Real stores are **watch-and-alert only**. Buying automatically needs the store to accept AI buyers (through programmes such as PayPal's agentic commerce services); the demo stores play that role.
- Scout reads the product data that stores publish for search engines. Pages that build themselves in the browser without publishing it (some ticketing and creator platforms) can't be read yet, and Standby says so.
- Everything runs on the PayPal sandbox with test money.

## Run locally

```bash
npm install
cp .env.example .env   # add your keys
npx prisma db push
npm run dev            # http://localhost:3300
```

Keys: `ANTHROPIC_API_KEY` (required), `GEMINI_API_KEY` (optional; Scout uses Claude without it), `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` from a PayPal sandbox REST app (needed for Buy it for me). See `.env.example`.

## License

MIT
