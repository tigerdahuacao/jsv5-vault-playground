# API Trace Log + Pay-with-Saved-Card Debounce — Design

Date: 2026-10-17

## 1. Problem

1. This project is a PayPal sandbox test tool. Every PayPal REST call (create order, capture order, setup-token, payment-token, generic proxy, init token exchange) is only logged server-side via `console.log`. Testers using the deployed site have no way to see the real request/response bodies and headers without server log access. We want these visible directly on the page.
2. On `checkout-ACDC`, the returning-buyer flow shows a green "Pay with Saved Card" button (`src/app/checkout-ACDC/page.tsx`, `handlePay`). Clicking it has no guard — a fast double click fires two concurrent `createOrderCallback` + `onApproveCallback` calls, which can create two separate orders/captures against the same saved card.

## 2. Scope

### In scope — API trace log

All real PayPal API calls triggered from the UI, across every checkout/save page:

| Function (`src/lib/paypal-api.ts`) | Used by route | Used by page(s) |
|---|---|---|
| `generateClientToken` + `generateToken` | `GET /api/vault/init` | all pages (on load) |
| `createOrder` | `POST /api/orders` | checkout-ACDC, checkout-PayPal |
| `captureOrder` (incl. internal `getOrderDetail`) | `POST /api/orders/[orderID]/capture` | checkout-ACDC, checkout-PayPal |
| `createSetupTokenSaveCard` | `GET /api/vault/setup-token-card` | save-card |
| `createSetupTokenSavePayPal` | `GET /api/vault/setup-token-paypal` | save-PayPal |
| `createPaymentToken` | `GET /api/vault/payment-token` | save-card, save-PayPal |
| `callPayPalAPI` | `POST`/`GET /api/vault/paypal-api` | checkout-API (4-step demo) |

Not in scope: `POST /api/vault/store-params` and `POST /api/client-credentials` — these don't call PayPal, they write to the local lowdb only.

Headers are shown **as-is, unmasked** — including `Authorization: Bearer <access_token>` and `Authorization: Basic <base64(clientId:secret)>` on the init call. This is consistent with existing behavior: `ClientIDPanel` already has a "Show" toggle that reveals the client secret in plaintext, so the Basic-auth header doesn't expose anything not already surfaced elsewhere in the UI. No redaction logic is introduced.

### In scope — debounce

Only the "Pay with Saved Card" button in `checkout-ACDC/page.tsx` (returning-buyer branch). The first-time-buyer "Pay Now" flow goes through PayPal's own `CardFields.submit()`, which already guards against re-submission internally — out of scope.

### Out of scope

- Persisting trace entries (survives only for the current page session, cleared on reload/navigation).
- Any change to `checkout-PayPal`'s or `checkout-API`'s existing visual layout beyond adding the trace panel.
- Rate-limit-style time-based debounce (e.g. "ignore clicks within 500ms") — a simple "disable while in-flight" guard is sufficient and matches the existing `isLoading` state already in the component.

## 3. Architecture — API Trace Log

### 3.1 Data shape

New shared type, in a client-safe file (no server-only imports) so both server routes and client components can import it:

```ts
// src/types/trace.ts
export interface ApiTraceEntry {
  id: string;            // crypto.randomUUID()
  label: string;          // e.g. "Create Order", "Capture Order", "Init — Generate Token"
  timestamp: number;      // Date.now()
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: unknown;
  };
}
```

### 3.2 Server side — building the trace

`src/lib/paypal-api.ts`:

- `handleResponse` gains the inputs it needs to build a trace (label, method, url, request headers, request body) and returns `{ jsonResponse, httpStatusCode, trace }` instead of just `{ jsonResponse, httpStatusCode }`.
- Every exported function that calls PayPal (`generateToken`, `generateClientToken`, `createOrder`, `captureOrder`, `createSetupTokenSaveCard`, `createSetupTokenSavePayPal`, `createPaymentToken`, `callPayPalAPI`) is updated to pass through the request details and propagate `trace` in its return value.
- `captureOrder` internally calls `getOrderDetail` first (a GET to check order status) and then the actual capture POST. Only the capture POST is traced as the primary entry — `getOrderDetail` is an implementation detail of this test harness, not something the PayPal integration guide asks testers to inspect. (If this turns out to be wanted later, it's a small additive change.)
- Response headers are captured via `Object.fromEntries(response.headers.entries())`.

### 3.3 Transport — route handlers

Each API route (`orders/route.ts`, `orders/[orderID]/capture/route.ts`, `vault/init/route.ts`, `vault/setup-token-card/route.ts`, `vault/setup-token-paypal/route.ts`, `vault/payment-token/route.ts`, `vault/paypal-api/route.ts`) embeds the trace into the JSON body it already returns:

```ts
return NextResponse.json({ ...jsonResponse, __trace: trace }, { status: httpStatusCode });
```

`__trace` is a reserved key chosen to avoid collision with real PayPal response fields. `/api/vault/init` returns two traces (client-token call + generate-token call) — represented as `__trace: [trace1, trace2]` for that route only (the only one needing more than one entry per call), other routes use a single object.

### 3.4 Client side — collecting and stripping

New helper `src/lib/api-trace.ts`:

```ts
export function extractTrace<T extends Record<string, unknown>>(
  data: T
): { data: Omit<T, "__trace">; trace: ApiTraceEntry[] } {
  // pulls __trace (object or array) out of data, normalizes to ApiTraceEntry[],
  // returns the rest of `data` untouched for existing call sites to keep using
}
```

Each page keeps a local `const [traceEntries, setTraceEntries] = useState<ApiTraceEntry[]>([])`. After every relevant `fetch(...).then(r => r.json())`, the page calls `extractTrace` and appends the result (newest first) via `setTraceEntries(prev => [...trace, ...prev])`. This touches the existing fetch call sites listed in the scope table — each gets a two-line addition, no control-flow changes.

### 3.5 Display — `ApiTraceLog` component

New component `src/components/ApiTraceLog.tsx`, styled consistently with `ResultArea`'s terminal look (monospace, dark panel, copy button):

- Props: `entries: ApiTraceEntry[]`.
- Panel header: `API Trace (n)`.
- Each entry renders as a collapsible row (collapsed by default):
  - Header: method + path (not full URL, to keep it short) + status badge (emerald for 2xx/299, rose for 4xx/5xx) + relative/short timestamp.
  - Expanded body: four labeled sub-sections — Request Headers, Request Body, Response Headers, Response Body — each pretty-printed JSON in a `<pre>` block with its own copy button (reuse the copy-to-clipboard pattern already in `ResultArea`).
- Empty state: panel not rendered at all if `entries.length === 0` (avoids clutter before any call has happened).

### 3.6 Page wiring

- `checkout-ACDC`, `checkout-PayPal`: render `<ApiTraceLog entries={traceEntries} />` directly under `<ResultArea />`.
- `save-card`, `save-PayPal`: same placement under their result area.
- `checkout-API`: existing per-step request/response textareas are untouched. `<ApiTraceLog entries={traceEntries} />` is added once near the bottom of the page (under the global result), accumulating entries from all 4 steps in call order — this is purely additive, giving header visibility the per-step UI doesn't have.
- All pages: init call's trace entries are captured in `handleInitLoaded` (or wherever `/api/vault/init`'s response is parsed) and seeded into `traceEntries` first.

## 4. Architecture — Debounce

`src/app/checkout-ACDC/page.tsx`, returning-buyer button:

```tsx
<button
  onClick={handlePay}
  disabled={isLoading}
  className={cn(/* existing classes */, "disabled:opacity-60 disabled:cursor-not-allowed")}
>
  {isLoading ? "Processing..." : "Pay with Saved Card"}
</button>
```

`handlePay`'s returning-buyer branch starts with an early-return guard:

```ts
if (useVault && payVaultId) {
  if (isLoading) return;
  setIsLoading(true);
  try {
    const orderId = await createOrderCallback();
    await onApproveCallback({ orderID: orderId });
  } catch (err) {
    setIsLoading(false);
    showResult(`Transaction failed: ${err}`, "error");
  }
  return;
}
```

Note `onApproveCallback` already calls `setIsLoading(true)` again internally and `setIsLoading(false)` on completion/error — this stays as-is; the early guard in `handlePay` only prevents a *second* click from starting a *second* concurrent flow while the first is in progress.

## 5. Testing

- Manual verification via the `run` skill / dev server: trigger each flow (ACDC first-time + returning, PayPal, API 4-step, save-card, save-PayPal) and confirm the trace panel shows accurate method/URL/headers/bodies matching what's already in server console logs.
- Manual: rapid double-click "Pay with Saved Card" and confirm only one order/capture request fires (observe network tab or the trace log itself — should show exactly one `Create Order` + one `Capture Order` entry per click-sequence).
- No automated test suite exists in this repo (`CLAUDE.md` lists only `pnpm tsc --noEmit` as a check); `pnpm tsc --noEmit` must pass after the change.

## 6. Risks / trade-offs

- Embedding `__trace` in the body is a (small) response-shape change. Reviewed all client-side consumers of these routes' responses — none do blind full-object comparisons or schema validation that `__trace` would break; they all read specific named fields (`data.id`, `data.status`, etc.).
- Showing raw secrets/tokens in the browser is acceptable for this project per explicit user confirmation — this is an internal sandbox test tool, not a production surface, and equivalent exposure already exists via `ClientIDPanel`.
