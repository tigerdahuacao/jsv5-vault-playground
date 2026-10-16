# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev           # Start dev server (http://localhost:3000)
pnpm build         # Production build
pnpm tsc --noEmit  # Type-check only
```

## Architecture

Next.js 16 App Router — TypeScript, Tailwind CSS v4, pnpm. All pages are Client Components (need browser for PayPal SDK). API routes are server-side.

**Pages:**

| Route | File | Purpose |
|---|---|---|
| `/` | `src/app/page.tsx` | Dashboard — flow selector, client config |
| `/checkout-ACDC` | `src/app/checkout-ACDC/page.tsx` | Card (ACDC) checkout with vault |
| `/checkout-PayPal` | `src/app/checkout-PayPal/page.tsx` | PayPal Smart Button with vault |
| `/checkout-API` | `src/app/checkout-API/page.tsx` | 4-step raw API vault demo |
| `/save-card` | `src/app/save-card/page.tsx` | Save card without purchase |
| `/save-PayPal` | `src/app/save-PayPal/page.tsx` | Save PayPal without purchase |

**API Routes:**

| Endpoint | Purpose |
|---|---|
| `POST /api/orders` | Create PayPal order |
| `POST /api/orders/[orderID]/capture` | Capture order |
| `GET /api/vault/init` | Page init — stores session, returns clientId + tokens |
| `GET /api/vault/setup-token-card` | Create card setup token |
| `GET /api/vault/setup-token-paypal` | Create PayPal setup token |
| `GET /api/vault/payment-token?token_id=` | Convert setup → payment token |
| `POST /api/vault/store-params` | Store vault session flags in DB |
| `POST/GET /api/vault/paypal-api` | Generic PayPal API proxy (API Vault page) |
| `POST /api/client-credentials` | Persist selected app credentials to DB |

**Core libraries:**

- `src/lib/paypal-api.ts` — All PayPal REST API calls. Module-level state holds credentials between requests.
- `src/lib/db.ts` — LowDB 7 JSON wrapper. File: `data.json` in project root.
- `src/lib/config.ts` — All app credentials and test card data (replaces old `config/default.json`).
- `src/lib/utils.ts` — `cn()` Tailwind class merging helper.
- `src/types/paypal.d.ts` — Global `Window.paypal` type. Do NOT redeclare in individual files.

**Shared components:**

- `VaultCommonPart` — Calls `/api/vault/init` on mount. Shows party badge, customer ID, optional vault checkbox, optional order amount. Exposes state via `ref.getState()`.
- `ClientIDPanel` — 3rd/1st party dropdowns. POSTs to `/api/client-credentials` on change.
- `CardCopyInfo` — Test card with copy-to-clipboard buttons.
- `ResultArea` — Styled success/error/info/idle message box.

## PayPal SDK Loading Pattern

Each checkout page dynamically appends the SDK script after `/api/vault/init` resolves:

```ts
const script = document.createElement("script");
script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=card-fields`;
script.setAttribute("data-user-id-token", id_token);
script.onload = () => setSdkReady(true);
document.head.appendChild(script);
```

Card Fields / Buttons are initialized in a `useEffect` that depends on `sdkReady`.

## Deployment (Cloudflare Pages)

Build command is `npx @cloudflare/next-on-pages@1`, which fetches `@cloudflare/next-on-pages` and `wrangler` at their latest versions on every build (not pinned in this repo's `package.json`). This means a build can start failing with an `ERESOLVE` peer-dependency conflict (e.g. `wrangler`'s `@cloudflare/workers-types` peer range vs. `next-on-pages`'s own peer range) purely from upstream version drift — with zero changes to this repo's source. Don't assume a CF Pages build failure was caused by the latest commit; check whether the failure is a dependency-resolution error unrelated to the diff before investigating app code.

**Do not modify `package.json`, lockfiles, or add `.npmrc` (e.g. `legacy-peer-deps=true`) to work around a CF Pages build failure without explicit user approval first.** The user has asked to keep the dependency setup exactly as-is even when it causes an intermittent build failure — propose the fix and wait for confirmation rather than applying it.

## Two Merchant Models

- **3rd Party** (`is_use_PAYPAL_AUTH_ASSERTION=true`): Adds `Paypal-Auth-Assertion` header; reads/writes `3rdParty.*` in DB.
- **1st Party** (`is_use_PAYPAL_AUTH_ASSERTION=false`): Direct merchant; reads/writes `1stParty.*` in DB.

Selected via the Auth Mode toggle on the home page. Stored in DB and respected by all API routes via `/api/vault/init`.
