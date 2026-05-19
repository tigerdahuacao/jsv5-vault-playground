# PayPal JSv5 Vault Playground

A developer testing tool for PayPal Advanced Checkout & Vault integration. Covers card vaulting, PayPal account vaulting, first-time and returning buyer flows, and raw API exploration — all in one sandbox dashboard.

Built with Next.js 16 App Router, TypeScript, Tailwind CSS v4, deployed on Cloudflare Pages.

## Features

| Flow | Description |
|------|-------------|
| **ACDC Card Checkout** | Advanced Card Data Collection with vault support, 3DS, returning buyer |
| **PayPal Button Checkout** | Smart Payment Button with PayPal vault, first-time and returning |
| **Save Card (No Purchase)** | Vault a card without making a purchase |
| **Save PayPal (No Purchase)** | Vault a PayPal account without making a purchase |
| **API Vault Demo** | Step-by-step raw API flow — setup token → payment token → charge |

**Supported modes:**
- 3rd Party (partner) — PayPal-Auth-Assertion enabled, sub-merchant ID configurable
- 1st Party (direct merchant)
- First-time buyer / Returning buyer
- Vault state persisted per party × flow type (card vs PayPal)

## Local Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

**Required:** Add your PayPal sandbox credentials to `src/lib/config.ts` under `clientIDConfigs`.

## Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Dashboard
│   ├── checkout_ACDC/            # ACDC card checkout
│   ├── checkout_PayPal/          # PayPal Smart Button checkout
│   ├── checkout_API/             # Raw API vault demo
│   ├── save_card/                # Save card without purchase
│   ├── save_paypal/              # Save PayPal without purchase
│   └── api/
│       ├── orders/               # Create & capture orders
│       └── vault/                # Vault init, setup tokens, payment tokens
├── components/
│   ├── VaultCommonPart.tsx       # Shared vault state panel (customer ID, vault ID)
│   ├── ClientIDPanel.tsx         # App selector + sub-merchant ID input
│   ├── ResultArea.tsx            # Terminal-style log with JSON formatting
│   └── CardCopyInfo.tsx          # Test card with copy buttons
├── lib/
│   ├── paypal-api.ts             # All PayPal REST API calls
│   └── config.ts                 # Credentials and test data
└── store/
    └── vault.ts                  # Zustand store — vault data per party × flow type
```

## Deployment (Cloudflare Pages)

The app is configured for Cloudflare Pages with edge runtime.

**Build settings in CF Pages UI:**
- Framework preset: `Next.js`
- Build command: `npx @opennextjs/cloudflare build`
- Build output directory: `.open-next`
- Node.js version: `18`

**Compatibility flags** are set in `wrangler.toml`:
```toml
compatibility_flags = ["nodejs_compat"]
```

## Environment Variables

No environment variables required — all credentials are configured directly in `src/lib/config.ts` (sandbox testing tool only, not for production use).
