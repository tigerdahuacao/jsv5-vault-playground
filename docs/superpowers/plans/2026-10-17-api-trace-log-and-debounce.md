# API Trace Log + Pay-with-Saved-Card Debounce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show real PayPal request/response bodies and headers directly on every checkout/save page, and stop the ACDC "Pay with Saved Card" button from firing duplicate orders on a double click.

**Architecture:** Every `paypal-api.ts` function that calls PayPal builds an `ApiTraceEntry` (request+response method/url/headers/body) via a shared `handleResponse`/`buildTrace` pair; each API route embeds it in the JSON body under a reserved `__trace` key; pages extract it client-side and render it in a new `ApiTraceLog` terminal-style panel. The debounce is a plain `isLoading` guard already present in `checkout-ACDC`, just not wired to the button yet.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, Edge runtime API routes.

**Testing approach:** This repo has no automated test runner (`package.json` has no `jest`/`vitest`; `CLAUDE.md` lists only `pnpm tsc --noEmit` as a check). Every task below verifies with `pnpm tsc --noEmit` instead of unit tests, plus a manual browser check at the end (Task 15). Don't add a test framework as part of this plan — out of scope.

**Commit messages:** Follow the repo convention from the user's global `CLAUDE.md` — `<type>[<YYYY-MM-DD>]: <中文简述>` title, with `## 解决的问题` / `## 主要改动` / `## 为什么这么改` body sections as applicable. Run `date +%Y-%m-%d` fresh before each commit — don't hardcode a stale date if you're executing this plan on a different day than it was written (2026-10-17).

**Spec:** `docs/superpowers/specs/2026-10-17-api-trace-log-and-debounce-design.md`

---

### Task 1: Shared `ApiTraceEntry` type

**Files:**
- Create: `src/types/trace.ts`

- [ ] **Step 1: Create the type file**

```ts
export interface ApiTraceEntry {
  id: string;
  label: string;
  timestamp: number;
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

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no new errors (this file has no consumers yet, should pass trivially).

- [ ] **Step 3: Commit**

```bash
git add src/types/trace.ts
git commit -m "$(cat <<'EOF'
feat[<today's date>]: 新增 API trace 日志的共享类型定义

## 解决的问题
为后续在页面上展示 PayPal 请求/响应 body+header 的功能提供统一的数据结构

## 主要改动
- src/types/trace.ts: 新增 ApiTraceEntry 接口，描述一次 PayPal API 调用的
  请求方法/URL/headers/body 和响应 status/headers/body
EOF
)"
```

---

### Task 2: `handleResponse` builds a trace

**Files:**
- Modify: `src/lib/paypal-api.ts:82-92`

- [ ] **Step 1: Add the import**

At the top of `src/lib/paypal-api.ts` (after the existing `const base = ...` line is fine, or with other top-level code), add:

```ts
import type { ApiTraceEntry } from "@/types/trace";
```

- [ ] **Step 2: Replace `handleResponse` with a trace-aware version**

Replace:

```ts
async function handleResponse(
  response: Response
): Promise<{ jsonResponse: Record<string, unknown>; httpStatusCode: number }> {
  try {
    const jsonResponse = await response.json();
    return { jsonResponse, httpStatusCode: response.status };
  } catch {
    const errorMessage = await response.text();
    throw new Error(errorMessage);
  }
}
```

with:

```ts
interface TraceInput {
  label: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody?: unknown;
}

function buildTrace(
  input: TraceInput,
  status: number,
  responseHeaders: Record<string, string>,
  responseBody: unknown
): ApiTraceEntry {
  return {
    id: crypto.randomUUID(),
    label: input.label,
    timestamp: Date.now(),
    request: {
      method: input.method,
      url: input.url,
      headers: input.requestHeaders,
      body: input.requestBody,
    },
    response: {
      status,
      headers: responseHeaders,
      body: responseBody,
    },
  };
}

async function handleResponse(
  response: Response,
  traceInput: TraceInput
): Promise<{ jsonResponse: Record<string, unknown>; httpStatusCode: number; trace: ApiTraceEntry }> {
  const responseHeaders = Object.fromEntries(response.headers.entries());
  try {
    const jsonResponse = await response.json();
    const trace = buildTrace(traceInput, response.status, responseHeaders, jsonResponse);
    return { jsonResponse, httpStatusCode: response.status, trace };
  } catch {
    const errorMessage = await response.text();
    throw new Error(errorMessage);
  }
}
```

- [ ] **Step 3: Type-check (expect failures — this is fine for this step)**

Run: `pnpm tsc --noEmit`
Expected: FAIL — every call site of `handleResponse` (in `createSetupTokenSavePayPal`, `createSetupTokenSaveCard`, `createPaymentToken`, `createOrder`, `getOrderDetail`, `captureOrder`, `callPayPalAPI`) now errors with "Expected 2 arguments, but got 1." This is expected; Tasks 3–5 fix every call site. Do not fix them in this task — just confirm the error list matches these 7 call sites and nothing else.

- [ ] **Step 4: Commit**

```bash
git add src/lib/paypal-api.ts
git commit -m "$(cat <<'EOF'
feat[<today's date>]: handleResponse 改造为同时构建 API trace

## 解决的问题
为页面展示 PayPal 请求/响应做准备——handleResponse 是所有 PayPal 调用
响应解析的唯一出口，在这里统一构建 trace 记录最省重复代码

## 主要改动
- src/lib/paypal-api.ts: 新增 buildTrace()，handleResponse() 增加
  traceInput 参数并在返回值里附带 trace；调用方尚未更新，属于预期的
  中间状态，下一个 commit 会修完
EOF
)"
```

Note: this commit intentionally leaves the file in a non-compiling state for one commit — that's acceptable here because Task 3 immediately follows and fixes it; this is a rare exception to "always leave things working," justified by `handleResponse` being a single choke point that's awkward to change gradually. If your execution mode insists on a green `tsc` before every commit, merge Task 2 and Task 3 into one commit instead.

---

### Task 3: Propagate trace through `generateToken` and `generateClientToken`

**Files:**
- Modify: `src/lib/paypal-api.ts:103-170` (original line numbers, before Task 2's edit shifted things — locate by function name, not line number, since Task 2 already changed the file)

- [ ] **Step 1: Update `generateToken`**

Replace the whole `generateToken` function body with:

```ts
export async function generateToken(params: GenerateTokenParams): Promise<{
  access_token: string;
  id_token: string;
  trace: ApiTraceEntry;
}> {
  const { clientId, secret, vaultModel, customerId, merchantId, isUseAuthAssertion } = params;

  if (!clientId || !secret) {
    throw new Error("MISSING_API_CREDENTIALS");
  }

  const requestBody: Record<string, string> = {
    grant_type: "client_credentials",
    response_type: "id_token",
  };

  const auth = Buffer.from(clientId + ":" + secret).toString("base64");
  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
  };

  if (vaultModel === "returning") {
    requestBody["target_customer_id"] = customerId;
    if (isUseAuthAssertion) {
      headers["PayPal-Auth-Assertion"] = generatePayPalAuthAssertion(
        clientId,
        merchantId
      );
    }
  }

  const url = `${base}/v1/oauth2/token`;
  const response = await fetch(url, {
    method: "POST",
    body: new URLSearchParams(requestBody),
    headers,
  });

  const data = (await response.json()) as {
    access_token: string;
    id_token: string;
  };
  access_token = data.access_token;
  const trace = buildTrace(
    { label: "Init — Generate Access Token", method: "POST", url, requestHeaders: headers, requestBody },
    response.status,
    Object.fromEntries(response.headers.entries()),
    data
  );
  return { access_token: data.access_token, id_token: data.id_token, trace };
}
```

- [ ] **Step 2: Update `generateClientToken`**

Replace the whole `generateClientToken` function with:

```ts
// Deprecated but kept to avoid breaking flows
export async function generateClientToken(params: {
  clientId: string;
  secret: string;
  customerId: string;
}): Promise<{ client_token?: string; trace?: ApiTraceEntry }> {
  const { clientId, secret, customerId } = params;
  if (!clientId || !secret) return {};

  const url = `${base}/v1/identity/generate-token`;
  const auth = Buffer.from(clientId + ":" + secret).toString("base64");
  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json",
  };
  const requestBody = { customer_id: customerId };

  try {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(requestBody),
      headers,
    });
    const data = (await response.json()) as { client_token: string };
    const trace = buildTrace(
      { label: "Init — Generate Client Token (deprecated)", method: "POST", url, requestHeaders: headers, requestBody },
      response.status,
      Object.fromEntries(response.headers.entries()),
      data
    );
    return { client_token: data.client_token, trace };
  } catch {
    return {};
  }
}
```

- [ ] **Step 3: Update the one call site — `src/app/api/vault/init/route.ts`**

Replace the full file with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { generateToken, generateClientToken } from "@/lib/paypal-api";
import { clientIDConfigs, testCard } from "@/lib/config";
import type { ApiTraceEntry } from "@/types/trace";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vault_model = searchParams.get("model") || "firstTime";
    const is_use_PAYPAL_AUTH_ASSERTION =
      searchParams.get("is_use_PAYPAL_AUTH_ASSERTION") === "true";
    const appTag = searchParams.get("appTag") || "";
    const customerID = searchParams.get("customerID") || "";
    const vaultID = searchParams.get("vaultID") || "";
    const merchantID = searchParams.get("merchantID") || "";
    const route = searchParams.get("route") || "";

    const entry = is_use_PAYPAL_AUTH_ASSERTION
      ? clientIDConfigs.thirdParty[appTag]
      : clientIDConfigs.firstParty[appTag];
    const PAYPAL_CLIENT_ID = entry?.clientID || "";
    const PAYPAL_CLIENT_SECRET = entry?.secret || "";

    const clientTokenResult = await generateClientToken({
      clientId: PAYPAL_CLIENT_ID,
      secret: PAYPAL_CLIENT_SECRET,
      customerId: customerID,
    });
    const { id_token, access_token, trace: tokenTrace } = await generateToken({
      clientId: PAYPAL_CLIENT_ID,
      secret: PAYPAL_CLIENT_SECRET,
      vaultModel: vault_model,
      customerId: customerID,
      merchantId: merchantID,
      isUseAuthAssertion: is_use_PAYPAL_AUTH_ASSERTION,
    });

    const __trace: ApiTraceEntry[] = [clientTokenResult.trace, tokenTrace].filter(
      (t): t is ApiTraceEntry => Boolean(t)
    );

    return NextResponse.json({
      clientId: PAYPAL_CLIENT_ID,
      access_token,
      id_token,
      VAULT_MODEL: vault_model,
      CUSTOMER_ID: customerID,
      VAULT_ID: vaultID,
      TEST_MERCHANT_ID: merchantID,
      is_use_PAYPAL_AUTH_ASSERTION,
      route,
      ...testCard,
      __trace,
    });
  } catch (error) {
    console.error("Failed to init vault page:", error);
    return NextResponse.json(
      { error: "Failed to initialize page." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`
Expected: the `generateToken`/`generateClientToken` related errors from Task 2 are gone. Remaining errors should only be in `createOrder`, `captureOrder`, `getOrderDetail`, `createSetupTokenSaveCard`, `createSetupTokenSavePayPal`, `createPaymentToken`, `callPayPalAPI` (fixed in Tasks 4–5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/paypal-api.ts src/app/api/vault/init/route.ts
git commit -m "$(cat <<'EOF'
feat[<today's date>]: init 阶段的 generateToken/generateClientToken 接入 trace

## 主要改动
- src/lib/paypal-api.ts: generateToken、generateClientToken 返回值增加
  trace 字段
- src/app/api/vault/init/route.ts: 把两次 init 调用的 trace 合并成数组，
  通过 __trace 字段返回给页面
EOF
)"
```

---

### Task 4: Propagate trace through `createOrder` / `captureOrder`

**Files:**
- Modify: `src/lib/paypal-api.ts` (`createOrder`, `getOrderDetail`, `captureOrder`)
- Modify: `src/app/api/orders/route.ts`
- Modify: `src/app/api/orders/[orderID]/capture/route.ts`

- [ ] **Step 1: Update `createOrder`**

Replace the function with:

```ts
export async function createOrder(body: Record<string, unknown>): Promise<{
  jsonResponse: Record<string, unknown>;
  httpStatusCode: number;
  trace: ApiTraceEntry;
}> {
  const tag = "[paypal-api.createOrder]";
  const url = `${base}/v2/checkout/orders`;

  const headers = buildHeaders();
  const tokenPreview = access_token
    ? `${access_token.slice(0, 8)}...${access_token.slice(-4)}`
    : "(none)";
  console.log(`${tag} POST ${url}`);
  console.log(`${tag} access_token preview: ${tokenPreview}`);
  console.log(`${tag} is_use_PAYPAL_AUTH_ASSERTION: ${is_use_PAYPAL_AUTH_ASSERTION}`);
  console.log(`${tag} PayPal-Auth-Assertion header present: ${!!headers["Paypal-Auth-Assertion"]}`);
  console.log(`${tag} request body:`, JSON.stringify(body, null, 2));

  const response = await fetch(url, { headers, method: "POST", body: JSON.stringify(body) });

  console.log(`${tag} response status: ${response.status} ${response.statusText}`);
  const result = await handleResponse(response, {
    label: "Create Order",
    method: "POST",
    url,
    requestHeaders: headers,
    requestBody: body,
  });
  console.log(`${tag} parsed response:`, JSON.stringify(result.jsonResponse, null, 2));
  return result;
}
```

- [ ] **Step 2: Update `getOrderDetail` and `captureOrder`**

Replace both functions with:

```ts
async function getOrderDetail(
  requestHeaders: Record<string, string>,
  orderID: string
): Promise<string> {
  const url = `${base}/v2/checkout/orders/${orderID}`;
  const response = await fetch(url, { method: "GET", headers: requestHeaders });
  const result = await handleResponse(response, {
    label: "Get Order Detail (internal)",
    method: "GET",
    url,
    requestHeaders,
  });
  return result.jsonResponse.status === "COMPLETED"
    ? "ORDER_ALREADY_COMPLETED"
    : "ORDER_WAITING_CAPTURE";
}

export async function captureOrder(orderID: string): Promise<{
  jsonResponse: Record<string, unknown>;
  httpStatusCode: number | string;
  trace?: ApiTraceEntry;
}> {
  const url = `${base}/v2/checkout/orders/${orderID}/capture`;
  const requestHeaders = buildHeaders();

  const orderStatus = await getOrderDetail(requestHeaders, orderID);
  if (orderStatus === "ORDER_ALREADY_COMPLETED") {
    return {
      jsonResponse: { status: "ORDER_ALREADY_COMPLETED" },
      httpStatusCode: "299",
    };
  }

  const response = await fetch(url, { method: "POST", headers: requestHeaders });
  return handleResponse(response, {
    label: "Capture Order",
    method: "POST",
    url,
    requestHeaders,
  });
}
```

Note `captureOrder`'s `trace` is optional — the "already completed" short-circuit never calls PayPal's capture endpoint, so there's nothing to trace in that branch.

- [ ] **Step 3: Wire `__trace` into `src/app/api/orders/route.ts`**

Replace the `POST` handler's try block return line:

```ts
    const { jsonResponse, httpStatusCode, trace } = await createOrder(body);
    console.log(`${tag} PayPal response [${httpStatusCode}]:`, JSON.stringify(jsonResponse, null, 2));
    if (httpStatusCode >= 400) {
      console.error(`${tag} PayPal returned error status ${httpStatusCode}`);
    }
    return NextResponse.json({ ...jsonResponse, __trace: trace }, { status: httpStatusCode });
```

(This replaces the existing `const { jsonResponse, httpStatusCode } = await createOrder(body);` ... `return NextResponse.json(jsonResponse, { status: httpStatusCode });` block.)

- [ ] **Step 4: Wire `__trace` into `src/app/api/orders/[orderID]/capture/route.ts`**

Replace the full file with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { captureOrder, setRequestCredentials } from "@/lib/paypal-api";

export const runtime = "edge";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderID: string }> }
) {
  setRequestCredentials(
    request.headers.get("x-paypal-client-id") || "",
    request.headers.get("x-paypal-merchant-id") || "",
    request.headers.get("x-paypal-use-auth-assertion") === "true",
    request.headers.get("x-paypal-access-token") || ""
  );

  try {
    const { orderID } = await params;
    const { jsonResponse, httpStatusCode, trace } = await captureOrder(orderID);
    return NextResponse.json(
      { ...jsonResponse, ...(trace ? { __trace: trace } : {}) },
      { status: Number(httpStatusCode) || 200 }
    );
  } catch (error) {
    console.error("Failed to capture order:", error);
    return NextResponse.json({ error: "Failed to capture order." }, { status: 500 });
  }
}
```

- [ ] **Step 5: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors related to `createOrder`/`captureOrder`/`getOrderDetail` or the two routes touched in this task. Remaining errors (if any) should only be in `createSetupTokenSaveCard`, `createSetupTokenSavePayPal`, `createPaymentToken`, `callPayPalAPI`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/paypal-api.ts src/app/api/orders/route.ts "src/app/api/orders/[orderID]/capture/route.ts"
git commit -m "$(cat <<'EOF'
feat[<today's date>]: create/capture order 接口接入 API trace

## 解决的问题
这是本次需求的核心场景——在页面上展示 create order / capture order 的
真实请求和响应（body + header）

## 主要改动
- src/lib/paypal-api.ts: createOrder、captureOrder 返回值增加 trace；
  内部的 getOrderDetail 探测调用单独打 trace 但不对外传播（纯内部实现
  细节，不是测试者关心的调用）
- src/app/api/orders/route.ts: 响应体里附加 __trace 字段
- src/app/api/orders/[orderID]/capture/route.ts: 同上；订单已完成的
  短路分支没有真实调用 PayPal，不附加 __trace
EOF
)"
```

---

### Task 5: Propagate trace through setup-token / payment-token / generic proxy calls

**Files:**
- Modify: `src/lib/paypal-api.ts` (`createSetupTokenSavePayPal`, `createSetupTokenSaveCard`, `createPaymentToken`, `callPayPalAPI`)
- Modify: `src/app/api/vault/setup-token-card/route.ts`
- Modify: `src/app/api/vault/setup-token-paypal/route.ts`
- Modify: `src/app/api/vault/payment-token/route.ts`
- Modify: `src/app/api/vault/paypal-api/route.ts`

- [ ] **Step 1: Update `createSetupTokenSavePayPal`**

Replace the function with (body-construction logic unchanged, only the final fetch+return part changes):

```ts
export async function createSetupTokenSavePayPal(
  permitMultiplePaymentTokens = false,
  merchantCustomerId = ""
): Promise<{
  jsonResponse: Record<string, unknown>;
  httpStatusCode: number;
  trace: ApiTraceEntry;
}> {
  const url = `${base}/v3/vault/setup-tokens`;
  const paypalSource: Record<string, unknown> = {
    description: "Description for PayPal to be shown to PayPal payer",
    shipping: {
      name: { full_name: "Firstname Lastname" },
      address: {
        address_line_1: "2211 N First Street",
        address_line_2: "Building 17",
        admin_area_2: "San Jose",
        admin_area_1: "CA",
        postal_code: "95131",
        country_code: "US",
      },
    },
    permit_multiple_payment_tokens: permitMultiplePaymentTokens,
    usage_pattern: "IMMEDIATE",
    usage_type: "MERCHANT",
    customer_type: "CONSUMER",
    experience_context: {
      shipping_preference: "SET_PROVIDED_ADDRESS",
      payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
      brand_name: "EXAMPLE INC",
      locale: "en-US",
      return_url: "https://example.com/returnUrl",
      cancel_url: "https://example.com/cancelUrl",
    },
  };
  if (merchantCustomerId) {
    paypalSource.customer = { merchant_customer_id: merchantCustomerId };
  }
  const payload = { payment_source: { paypal: paypalSource } };

  console.log("[Save PayPal Setup Token API]:", JSON.stringify(payload, null, 2));

  const headers = buildHeaders();
  const response = await fetch(url, {
    headers,
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse(response, {
    label: "Create Setup Token (PayPal)",
    method: "POST",
    url,
    requestHeaders: headers,
    requestBody: payload,
  });
}
```

- [ ] **Step 2: Update `createSetupTokenSaveCard`**

Replace the function with:

```ts
export async function createSetupTokenSaveCard(
  merchantCustomerId = ""
): Promise<{
  jsonResponse: Record<string, unknown>;
  httpStatusCode: number;
  trace: ApiTraceEntry;
}> {
  const url = `${base}/v3/vault/setup-tokens`;
  const cardSource: Record<string, unknown> = {
    verification_method: "SCA_ALWAYS",
    experience_context: {
      brand_name: "GMS Rocks",
      locale: "de-DE",
      return_url: "https://example.com/returnUrl",
      cancel_url: "https://example.com/cancelUrl",
    },
  };
  if (merchantCustomerId) {
    cardSource.customer = { merchant_customer_id: merchantCustomerId };
  }
  const payload = { payment_source: { card: cardSource } };

  console.log("[Save Card Setup Token API]:", JSON.stringify(payload, null, 2));

  const headers = buildHeaders();
  const response = await fetch(url, {
    headers,
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse(response, {
    label: "Create Setup Token (Card)",
    method: "POST",
    url,
    requestHeaders: headers,
    requestBody: payload,
  });
}
```

- [ ] **Step 3: Update `createPaymentToken`**

Replace the function with:

```ts
export async function createPaymentToken(
  token_id: string
): Promise<{ jsonResponse: Record<string, unknown>; trace: ApiTraceEntry }> {
  const url = `${base}/v3/vault/payment-tokens`;
  const payload = {
    payment_source: { token: { id: token_id, type: "SETUP_TOKEN" } },
  };

  console.log("[Create Payment Token API]:", JSON.stringify(payload, null, 2));
  const headers = buildHeaders();
  const response = await fetch(url, {
    headers,
    method: "POST",
    body: JSON.stringify(payload),
  });

  const { jsonResponse, trace } = await handleResponse(response, {
    label: "Create Payment Token",
    method: "POST",
    url,
    requestHeaders: headers,
    requestBody: payload,
  });
  return { jsonResponse, trace };
}
```

- [ ] **Step 4: Update `callPayPalAPI`**

Replace the function with:

```ts
export async function callPayPalAPI(
  httpMethod: string,
  requestBody: Record<string, unknown> | null,
  endpoint: string,
  getPathParam?: string
): Promise<{ jsonResponse: Record<string, unknown>; httpStatusCode: number; trace: ApiTraceEntry }> {
  const url = `${base}${endpoint}`;
  const headers = buildHeaders();

  let response: Response;
  let finalUrl = url;
  if (httpMethod === "POST") {
    response = await fetch(url, {
      headers,
      method: "POST",
      body: JSON.stringify(requestBody),
    });
  } else {
    finalUrl = `${url}?${getPathParam}`;
    response = await fetch(finalUrl, { headers, method: "GET" });
  }

  return handleResponse(response, {
    label: `${httpMethod} ${endpoint}`,
    method: httpMethod,
    url: finalUrl,
    requestHeaders: headers,
    requestBody: httpMethod === "POST" ? requestBody ?? undefined : undefined,
  });
}
```

- [ ] **Step 5: Wire `__trace` into `src/app/api/vault/setup-token-card/route.ts`**

Replace the full file with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createSetupTokenSaveCard, setRequestCredentials } from "@/lib/paypal-api";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  setRequestCredentials(
    request.headers.get("x-paypal-client-id") || "",
    request.headers.get("x-paypal-merchant-id") || "",
    request.headers.get("x-paypal-use-auth-assertion") === "true",
    request.headers.get("x-paypal-access-token") || ""
  );
  try {
    const merchantCustomerId =
      request.nextUrl.searchParams.get("merchant_customer_id") || "";
    const { jsonResponse, httpStatusCode, trace } =
      await createSetupTokenSaveCard(merchantCustomerId);
    return NextResponse.json({ ...jsonResponse, __trace: trace }, { status: httpStatusCode });
  } catch (error) {
    console.error("Failed to create card setup token:", error);
    return NextResponse.json({ error: "Failed to create setup token." }, { status: 500 });
  }
}
```

- [ ] **Step 6: Wire `__trace` into `src/app/api/vault/setup-token-paypal/route.ts`**

Replace the full file with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createSetupTokenSavePayPal, setRequestCredentials } from "@/lib/paypal-api";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  setRequestCredentials(
    request.headers.get("x-paypal-client-id") || "",
    request.headers.get("x-paypal-merchant-id") || "",
    request.headers.get("x-paypal-use-auth-assertion") === "true",
    request.headers.get("x-paypal-access-token") || ""
  );
  try {
    const permitMultiple = request.nextUrl.searchParams.get("permit_multiple_payment_tokens") === "true";
    const merchantCustomerId =
      request.nextUrl.searchParams.get("merchant_customer_id") || "";
    const { jsonResponse, httpStatusCode, trace } = await createSetupTokenSavePayPal(
      permitMultiple,
      merchantCustomerId,
    );
    return NextResponse.json({ ...jsonResponse, __trace: trace }, { status: httpStatusCode });
  } catch (error) {
    console.error("Failed to create PayPal setup token:", error);
    return NextResponse.json({ error: "Failed to create setup token." }, { status: 500 });
  }
}
```

- [ ] **Step 7: Wire `__trace` into `src/app/api/vault/payment-token/route.ts`**

Replace the full file with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createPaymentToken, setRequestCredentials } from "@/lib/paypal-api";


export const runtime = "edge";

export async function GET(request: NextRequest) {
  setRequestCredentials(
    request.headers.get("x-paypal-client-id") || "",
    request.headers.get("x-paypal-merchant-id") || "",
    request.headers.get("x-paypal-use-auth-assertion") === "true",
    request.headers.get("x-paypal-access-token") || ""
  );
  try {
    const { searchParams } = new URL(request.url);
    const token_id = searchParams.get("token_id");
    if (!token_id) {
      return NextResponse.json({ error: "token_id is required" }, { status: 400 });
    }
    const { jsonResponse, trace } = await createPaymentToken(token_id);
    return NextResponse.json({ ...jsonResponse, __trace: trace });
  } catch (error) {
    console.error("Failed to create payment token:", error);
    return NextResponse.json({ error: "Failed to create payment token." }, { status: 500 });
  }
}
```

- [ ] **Step 8: Wire `__trace` into `src/app/api/vault/paypal-api/route.ts`**

Replace the full file with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { callPayPalAPI, setRequestCredentials } from "@/lib/paypal-api";

export const runtime = "edge";

function initFromRequest(request: NextRequest) {
  setRequestCredentials(
    request.headers.get("x-paypal-client-id") || "",
    request.headers.get("x-paypal-merchant-id") || "",
    request.headers.get("x-paypal-use-auth-assertion") === "true",
    request.headers.get("x-paypal-access-token") || ""
  );
}

export async function POST(request: NextRequest) {
  initFromRequest(request);
  try {
    const body = await request.json();
    const { endpoint, requestBody } = body;
    const { jsonResponse, httpStatusCode, trace } = await callPayPalAPI("POST", requestBody, endpoint);
    return NextResponse.json({ ...jsonResponse, __trace: trace }, { status: httpStatusCode });
  } catch (error) {
    console.error("PayPal API call failed:", error);
    return NextResponse.json({ error: "PayPal API call failed." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  initFromRequest(request);
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get("endpoint") || "";
    const getPathParam = searchParams.get("pathParam") || "";
    const { jsonResponse, httpStatusCode, trace } = await callPayPalAPI("GET", null, endpoint, getPathParam);
    return NextResponse.json({ ...jsonResponse, __trace: trace }, { status: httpStatusCode });
  } catch (error) {
    console.error("PayPal API call failed:", error);
    return NextResponse.json({ error: "PayPal API call failed." }, { status: 500 });
  }
}
```

- [ ] **Step 9: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS, zero errors. All `handleResponse` call sites now pass a `TraceInput`, and every route embeds `__trace`.

- [ ] **Step 10: Commit**

```bash
git add src/lib/paypal-api.ts \
  src/app/api/vault/setup-token-card/route.ts \
  src/app/api/vault/setup-token-paypal/route.ts \
  src/app/api/vault/payment-token/route.ts \
  src/app/api/vault/paypal-api/route.ts
git commit -m "$(cat <<'EOF'
feat[<today's date>]: setup-token/payment-token/通用代理接口接入 API trace

## 主要改动
- src/lib/paypal-api.ts: createSetupTokenSavePayPal、
  createSetupTokenSaveCard、createPaymentToken、callPayPalAPI
  返回值增加 trace
- 对应 4 个 route：响应体里附加 __trace 字段

## 为什么这么改
至此所有真正调用 PayPal 的接口（init、create/capture order、
setup-token、payment-token、通用代理）都统一接入了同一套 trace 机制
EOF
)"
```

---

### Task 6: Widen `VaultInitData` to carry the init trace

**Files:**
- Modify: `src/components/VaultCommonPart.tsx:46-59`

- [ ] **Step 1: Add the `__trace` field to the interface**

Replace:

```ts
export interface VaultInitData {
  clientId: string;
  access_token: string;
  id_token: string;
  VAULT_MODEL: string;
  CUSTOMER_ID: string;
  VAULT_ID: string;
  TEST_MERCHANT_ID: string;
  is_use_PAYPAL_AUTH_ASSERTION: boolean;
  route: string;
  PAYPAL_TEST_CARD_NO: string;
  PAYPAL_TEST_CARD_DATE: string;
  PAYPAL_TEST_CARD_CVV: string;
}
```

with:

```ts
export interface VaultInitData {
  clientId: string;
  access_token: string;
  id_token: string;
  VAULT_MODEL: string;
  CUSTOMER_ID: string;
  VAULT_ID: string;
  TEST_MERCHANT_ID: string;
  is_use_PAYPAL_AUTH_ASSERTION: boolean;
  route: string;
  PAYPAL_TEST_CARD_NO: string;
  PAYPAL_TEST_CARD_DATE: string;
  PAYPAL_TEST_CARD_CVV: string;
  __trace?: ApiTraceEntry[];
}
```

And add the import at the top of the file (next to the existing `useVaultStore` import):

```ts
import type { ApiTraceEntry } from "@/types/trace";
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS, zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/VaultCommonPart.tsx
git commit -m "$(cat <<'EOF'
feat[<today's date>]: VaultInitData 类型增加 __trace 字段

## 主要改动
- src/components/VaultCommonPart.tsx: VaultInitData 增加可选的 __trace
  字段，让 /api/vault/init 返回的 init 阶段 trace 能透传给各页面的
  onInitDataLoaded 回调
EOF
)"
```

---

### Task 7: Client-side trace extraction helper + hook

**Files:**
- Create: `src/lib/api-trace.ts`
- Create: `src/hooks/useApiTraceLog.ts`

- [ ] **Step 1: Create `extractTrace`**

```ts
import type { ApiTraceEntry } from "@/types/trace";

type WithTrace = { __trace?: ApiTraceEntry | ApiTraceEntry[] };

/**
 * Pulls the server-embedded `__trace` field out of a parsed API response,
 * normalizing it to an array and returning the rest of the payload untouched
 * so existing call sites can keep reading their named fields (`data.id`, etc.).
 */
export function extractTrace<T extends WithTrace>(
  data: T
): { data: Omit<T, "__trace">; trace: ApiTraceEntry[] } {
  const { __trace, ...rest } = data;
  const trace = !__trace ? [] : Array.isArray(__trace) ? __trace : [__trace];
  return { data: rest, trace };
}
```

- [ ] **Step 2: Create `useApiTraceLog`**

```ts
"use client";

import { useCallback, useState } from "react";
import type { ApiTraceEntry } from "@/types/trace";

export function useApiTraceLog() {
  const [entries, setEntries] = useState<ApiTraceEntry[]>([]);

  const pushTrace = useCallback((newEntries: ApiTraceEntry[]) => {
    if (newEntries.length === 0) return;
    setEntries((prev) => [...newEntries, ...prev]);
  }, []);

  return { entries, pushTrace };
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS, zero errors (nothing imports these two files yet).

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-trace.ts src/hooks/useApiTraceLog.ts
git commit -m "$(cat <<'EOF'
feat[<today's date>]: 新增前端 trace 摘取工具和 useApiTraceLog hook

## 主要改动
- src/lib/api-trace.ts: extractTrace()，从接口响应里摘出 __trace 字段，
  剩余字段原样返回，不影响现有业务逻辑的字段读取
- src/hooks/useApiTraceLog.ts: useApiTraceLog()，页面内维护一份按时间
  倒序排列的 trace 列表，供 ApiTraceLog 组件展示
EOF
)"
```

---

### Task 8: `ApiTraceLog` display component

**Files:**
- Create: `src/components/ApiTraceLog.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

/**
 * ApiTraceLog — PayPal API 调用的请求/响应 trace 展示面板
 *
 * 展示 paypal-api.ts 每次真实调用 PayPal 的方法/URL/headers/body
 * 和响应 status/headers/body。纯前端内存状态，刷新页面即清空。
 *
 * 使用位置：
 * - src/app/checkout-ACDC/page.tsx
 * - src/app/checkout-PayPal/page.tsx
 * - src/app/checkout-API/page.tsx
 * - src/app/save-card/page.tsx
 * - src/app/save-PayPal/page.tsx
 */

import { useState } from "react";
import type { ApiTraceEntry } from "@/types/trace";
import { cn } from "@/lib/utils";

interface ApiTraceLogProps {
  entries: ApiTraceEntry[];
  className?: string;
}

function JsonBlock({ title, data }: { title: string; data: unknown }) {
  const [copied, setCopied] = useState(false);
  const text =
    data === undefined
      ? "(none)"
      : typeof data === "string"
        ? data
        : JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          {title}
        </span>
        <button
          onClick={handleCopy}
          className="text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <pre className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/40 overflow-x-auto text-[11px] leading-relaxed text-slate-300">
        {text}
      </pre>
    </div>
  );
}

function TraceRow({ entry }: { entry: ApiTraceEntry }) {
  const [expanded, setExpanded] = useState(false);
  const ok = entry.response.status >= 200 && entry.response.status < 300;
  const path = (() => {
    try {
      return new URL(entry.request.url).pathname;
    } catch {
      return entry.request.url;
    }
  })();

  return (
    <div className="border-b border-slate-700/40 last:border-b-0">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-800/40 transition-colors"
      >
        <span className={cn("w-2 h-2 rounded-full shrink-0", ok ? "bg-emerald-500" : "bg-rose-500")} />
        <span className="text-xs font-mono text-slate-300 shrink-0">{entry.request.method}</span>
        <span className="text-xs font-mono text-slate-500 truncate flex-1">{path}</span>
        <span className={cn("text-[10px] font-bold shrink-0", ok ? "text-emerald-400" : "text-rose-400")}>
          {entry.response.status}
        </span>
        <span className="text-[10px] text-slate-600 font-mono shrink-0">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
        <span className="text-slate-600 text-xs shrink-0">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs font-semibold text-slate-400">{entry.label}</p>
          <JsonBlock title="Request Headers" data={entry.request.headers} />
          <JsonBlock title="Request Body" data={entry.request.body} />
          <JsonBlock title="Response Headers" data={entry.response.headers} />
          <JsonBlock title="Response Body" data={entry.response.body} />
        </div>
      )}
    </div>
  );
}

export default function ApiTraceLog({ entries, className }: ApiTraceLogProps) {
  if (entries.length === 0) return null;

  return (
    <div className={cn("rounded-xl overflow-hidden border border-slate-700/60 bg-[#0f1117]", className)}>
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/60">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          API Trace ({entries.length})
        </span>
      </div>
      <div className="max-h-[32rem] overflow-y-auto">
        {entries.map((entry) => (
          <TraceRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS, zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ApiTraceLog.tsx
git commit -m "$(cat <<'EOF'
feat[<today's date>]: 新增 ApiTraceLog 组件展示 API trace

## 主要改动
- src/components/ApiTraceLog.tsx: 终端风格的 trace 列表面板，复用
  ResultArea 的视觉语言（深色面板 + 等宽字体 + 一键复制），每条调用
  默认折叠，展开后分 Request Headers / Request Body / Response Headers
  / Response Body 四块展示
EOF
)"
```

---

### Task 9: Wire into `checkout-ACDC` + fix the debounce

**Files:**
- Modify: `src/app/checkout-ACDC/page.tsx`

- [ ] **Step 1: Add imports**

Near the top of the file, alongside the existing imports:

```ts
import ApiTraceLog from "@/components/ApiTraceLog";
import { useApiTraceLog } from "@/hooks/useApiTraceLog";
import { extractTrace } from "@/lib/api-trace";
```

- [ ] **Step 2: Add the hook call**

Inside `CheckoutACDCContent`, near the other hook calls (e.g. right after `const saveVaultResult = useVaultStore((s) => s.saveVaultResult);`):

```ts
  const { entries: traceEntries, pushTrace } = useApiTraceLog();
```

- [ ] **Step 3: Capture the init trace**

In `handleInitLoaded`, replace:

```ts
  const handleInitLoaded = useCallback(
    (data: VaultInitData) => {
      setInitData(data);
      initDataRef.current = data;
      loadSdk(data);
```

with:

```ts
  const handleInitLoaded = useCallback(
    (data: VaultInitData) => {
      setInitData(data);
      initDataRef.current = data;
      pushTrace(data.__trace || []);
      loadSdk(data);
```

(leave the rest of the function body — the returning-buyer saved-card fetch — untouched).

- [ ] **Step 4: Capture the create-order trace**

In `createOrderCallback`, replace the final two lines:

```ts
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.id;
  }, []);
```

with:

```ts
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
      body: JSON.stringify(body),
    });
    const { data, trace } = extractTrace(await res.json());
    pushTrace(trace);
    return data.id;
  }, [pushTrace]);
```

- [ ] **Step 5: Capture the capture-order trace**

In `onApproveCallback`, replace:

```ts
    const res = await fetch(`/api/orders/${data.orderID}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
    });
    const captureData = await res.json();
```

with:

```ts
    const res = await fetch(`/api/orders/${data.orderID}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
    });
    const { data: captureData, trace } = extractTrace(await res.json());
    pushTrace(trace);
```

And add `pushTrace` to `onApproveCallback`'s dependency array — change:

```ts
  }, [showResult, isAuth, saveVaultResult]);
```

(the one that closes `onApproveCallback`) to:

```ts
  }, [showResult, isAuth, saveVaultResult, pushTrace]);
```

- [ ] **Step 6: Debounce the "Pay with Saved Card" flow**

In `handlePay`, replace:

```ts
  const handlePay = async () => {
    const state = vaultRef.current?.getState();
    const useVault = state?.useVault || false;
    const payVaultId = state?.vaultId || "";

    // Returning buyer: pay directly with vault_id, no card entry needed
    if (useVault && payVaultId) {
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

with:

```ts
  const handlePay = async () => {
    const state = vaultRef.current?.getState();
    const useVault = state?.useVault || false;
    const payVaultId = state?.vaultId || "";

    // Returning buyer: pay directly with vault_id, no card entry needed
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

- [ ] **Step 7: Disable the button while loading**

Replace the returning-buyer button:

```tsx
            <button
              onClick={handlePay}
              className="w-full py-4 rounded-lg bg-emerald-600 hover:bg-emerald-700
                text-white font-bold text-sm transition-all duration-150
                flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Pay with Saved Card
            </button>
```

with:

```tsx
            <button
              onClick={handlePay}
              disabled={isLoading}
              className="w-full py-4 rounded-lg bg-emerald-600 hover:bg-emerald-700
                text-white font-bold text-sm transition-all duration-150
                flex items-center justify-center gap-2
                disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {isLoading ? "Processing..." : "Pay with Saved Card"}
            </button>
```

- [ ] **Step 8: Render the trace panel**

Replace:

```tsx
        {/* Result */}
        <ResultArea message={resultMsg} type={resultType} />
```

with:

```tsx
        {/* Result */}
        <ResultArea message={resultMsg} type={resultType} />

        {/* API Trace */}
        <ApiTraceLog entries={traceEntries} />
```

- [ ] **Step 9: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS, zero errors.

- [ ] **Step 10: Manual check**

Run `pnpm dev`, open `/checkout-ACDC?model=returning&...` (pick a 1st/3rd party app with a saved vault ID on the dashboard first), click "Pay with Saved Card":
- Confirm an "API Trace" panel appears below the result area with at least 3 entries (init, create order, capture order).
- Expand one entry and confirm headers/body look like real PayPal data (e.g. `Authorization: Bearer ...` in Create Order's request headers).
- Rapid double-click the button and confirm only one Create Order + one Capture Order entry appear (not two), and the button shows "Processing..." and is unclickable during the request.

- [ ] **Step 11: Commit**

```bash
git add src/app/checkout-ACDC/page.tsx
git commit -m "$(cat <<'EOF'
feat[<today's date>]: checkout-ACDC 接入 API trace 面板，修复返回买家支付按钮重复点击

## 解决的问题
1. 页面上看不到 create order / capture order 的真实请求响应
2. returning buyer 的绿色 "Pay with Saved Card" 按钮没有防重复点击，
   手快连点会产生两笔订单

## 主要改动
- src/app/checkout-ACDC/page.tsx:
  - 接入 useApiTraceLog + ApiTraceLog，init/create order/capture order
    三处调用的 trace 汇总展示
  - handlePay 的 returning-buyer 分支增加 isLoading 提前返回 guard，
    按钮 disabled={isLoading} 并显示 "Processing..." 文案
EOF
)"
```

---

### Task 10: Wire into `checkout-PayPal`

**Files:**
- Modify: `src/app/checkout-PayPal/page.tsx`

- [ ] **Step 1: Add imports**

```ts
import ApiTraceLog from "@/components/ApiTraceLog";
import { useApiTraceLog } from "@/hooks/useApiTraceLog";
import { extractTrace } from "@/lib/api-trace";
```

- [ ] **Step 2: Add the hook call**

Next to `const saveVaultResult = useVaultStore((s) => s.saveVaultResult);`:

```ts
  const { entries: traceEntries, pushTrace } = useApiTraceLog();
```

- [ ] **Step 3: Capture the init trace**

Replace:

```ts
  const handleInitLoaded = useCallback(
    (data: VaultInitData) => {
      setInitData(data);
      initDataRef.current = data;
      loadSdk(data);
    },
    [loadSdk]
  );
```

with:

```ts
  const handleInitLoaded = useCallback(
    (data: VaultInitData) => {
      setInitData(data);
      initDataRef.current = data;
      pushTrace(data.__trace || []);
      loadSdk(data);
    },
    [loadSdk, pushTrace]
  );
```

- [ ] **Step 4: Capture the create-order trace (first-time / default flow)**

Replace:

```ts
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.id;
  }, []);
```

with:

```ts
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
      body: JSON.stringify(body),
    });
    const { data, trace } = extractTrace(await res.json());
    pushTrace(trace);
    return data.id;
  }, [pushTrace]);
```

- [ ] **Step 5: Capture the capture-order trace**

Replace:

```ts
      const res = await fetch(`/api/orders/${data.orderID}/capture`, {
        method: "POST",
        headers: buildPayPalHeaders(initDataRef.current),
      });
      const captureData = await res.json();
```

with:

```ts
      const res = await fetch(`/api/orders/${data.orderID}/capture`, {
        method: "POST",
        headers: buildPayPalHeaders(initDataRef.current),
      });
      const { data: captureData, trace } = extractTrace(await res.json());
      pushTrace(trace);
```

And update `onApprove`'s dependency array from:

```ts
    [showResult, isAuth, saveVaultResult]
  );
```

to:

```ts
    [showResult, isAuth, saveVaultResult, pushTrace]
  );
```

- [ ] **Step 6: Capture the trace for the returning-buyer vault createOrder override**

Replace:

```ts
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current!) },
          body: JSON.stringify(body),
        });
        const d = await res.json();
        return d.id;
      };
```

with:

```ts
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current!) },
          body: JSON.stringify(body),
        });
        const { data: d, trace } = extractTrace(await res.json());
        pushTrace(trace);
        return d.id;
      };
```

This override is built inside a `useEffect` — add `pushTrace` to that effect's dependency array. Replace:

```ts
  }, [sdkReady, initData, createOrder, onApprove, showResult, model]);
```

with:

```ts
  }, [sdkReady, initData, createOrder, onApprove, showResult, model, pushTrace]);
```

- [ ] **Step 7: Render the trace panel**

Replace:

```tsx
        <ResultArea message={resultMsg} type={resultType} />
      </div>
    </main>
  );
}
```

(the one at the end of `CheckoutPayPalContent`'s JSX, right before `ToggleOption`) with:

```tsx
        <ResultArea message={resultMsg} type={resultType} />

        <ApiTraceLog entries={traceEntries} />
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS, zero errors.

- [ ] **Step 9: Manual check**

`pnpm dev`, open `/checkout-PayPal`, complete a PayPal button payment (sandbox), confirm the API Trace panel shows init + create order + capture order entries.

- [ ] **Step 10: Commit**

```bash
git add src/app/checkout-PayPal/page.tsx
git commit -m "$(cat <<'EOF'
feat[<today's date>]: checkout-PayPal 接入 API trace 面板

## 主要改动
- src/app/checkout-PayPal/page.tsx: init / create order（含 returning
  buyer 的 vault_id 分支）/ capture order 三类调用全部接入
  useApiTraceLog，页面底部展示 ApiTraceLog
EOF
)"
```

---

### Task 11: Wire into `checkout-API`

**Files:**
- Modify: `src/app/checkout-API/page.tsx`

- [ ] **Step 1: Add imports**

```ts
import ApiTraceLog from "@/components/ApiTraceLog";
import { useApiTraceLog } from "@/hooks/useApiTraceLog";
import { extractTrace } from "@/lib/api-trace";
```

- [ ] **Step 2: Add the hook call**

Inside `CheckoutAPIContent`, next to `const [initData, setInitData] = useState<VaultInitData | null>(null);`:

```ts
  const { entries: traceEntries, pushTrace } = useApiTraceLog();
```

- [ ] **Step 3: Capture the init trace**

Replace:

```ts
  const handleInitLoaded = useCallback((data: VaultInitData) => {
    setInitData(data);
    initDataRef.current = data;
  }, []);
```

with:

```ts
  const handleInitLoaded = useCallback((data: VaultInitData) => {
    setInitData(data);
    initDataRef.current = data;
    pushTrace(data.__trace || []);
  }, [pushTrace]);
```

- [ ] **Step 4: Capture the Step 1 trace**

In `runStep1`, replace:

```ts
      const res = await fetch("/api/vault/paypal-api", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
        body: JSON.stringify({ endpoint: "/v3/vault/setup-tokens", requestBody: body }),
      });
      const data = await res.json();
      const pretty = JSON.stringify(data, null, 2);
      setStep1((s) => ({ ...s, loading: false, done: true, response: pretty }));
```

with:

```ts
      const res = await fetch("/api/vault/paypal-api", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
        body: JSON.stringify({ endpoint: "/v3/vault/setup-tokens", requestBody: body }),
      });
      const { data, trace } = extractTrace(await res.json());
      pushTrace(trace);
      const pretty = JSON.stringify(data, null, 2);
      setStep1((s) => ({ ...s, loading: false, done: true, response: pretty }));
```

(The rest of `runStep1`, which reads `data.id` to auto-fill step 2, stays unchanged — `data` is still the un-traced payload.)

- [ ] **Step 5: Capture the Step 2 trace**

In `runStep2`, replace:

```ts
      const res = await fetch("/api/vault/paypal-api", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
        body: JSON.stringify({ endpoint: "/v3/vault/payment-tokens", requestBody: body }),
      });
      const data = await res.json();
      const pretty = JSON.stringify(data, null, 2);
      setStep2((s) => ({ ...s, loading: false, done: true, response: pretty }));
```

with:

```ts
      const res = await fetch("/api/vault/paypal-api", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
        body: JSON.stringify({ endpoint: "/v3/vault/payment-tokens", requestBody: body }),
      });
      const { data, trace } = extractTrace(await res.json());
      pushTrace(trace);
      const pretty = JSON.stringify(data, null, 2);
      setStep2((s) => ({ ...s, loading: false, done: true, response: pretty }));
```

- [ ] **Step 6: Capture the Step 3 trace (create + capture)**

In `runStep3`, replace:

```ts
      const createRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
        body: JSON.stringify(body),
      });
      const orderData = await createRes.json();

      if (!orderData.id) {
        setStep3((s) => ({ ...s, loading: false, response: JSON.stringify(orderData, null, 2) }));
        return;
      }

      // Capture
      const captureRes = await fetch(`/api/orders/${orderData.id}/capture`, {
        method: "POST",
        headers: buildPayPalHeaders(initDataRef.current),
      });
      const captureData = await captureRes.json();
      const pretty = JSON.stringify(captureData, null, 2);
```

with:

```ts
      const createRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
        body: JSON.stringify(body),
      });
      const { data: orderData, trace: createTrace } = extractTrace(await createRes.json());
      pushTrace(createTrace);

      if (!orderData.id) {
        setStep3((s) => ({ ...s, loading: false, response: JSON.stringify(orderData, null, 2) }));
        return;
      }

      // Capture
      const captureRes = await fetch(`/api/orders/${orderData.id}/capture`, {
        method: "POST",
        headers: buildPayPalHeaders(initDataRef.current),
      });
      const { data: captureData, trace: captureTrace } = extractTrace(await captureRes.json());
      pushTrace(captureTrace);
      const pretty = JSON.stringify(captureData, null, 2);
```

- [ ] **Step 7: Capture the Step 4 trace**

In `runStep4`, replace:

```ts
      const res = await fetch(
        `/api/vault/paypal-api?endpoint=/v3/vault/payment-tokens&pathParam=customer_id=${customerId}`,
        { headers: buildPayPalHeaders(initDataRef.current) }
      );
      const data = await res.json();
      setStep4((s) => ({
        ...s,
        loading: false,
        done: true,
        response: JSON.stringify(data, null, 2),
      }));
```

with:

```ts
      const res = await fetch(
        `/api/vault/paypal-api?endpoint=/v3/vault/payment-tokens&pathParam=customer_id=${customerId}`,
        { headers: buildPayPalHeaders(initDataRef.current) }
      );
      const { data, trace } = extractTrace(await res.json());
      pushTrace(trace);
      setStep4((s) => ({
        ...s,
        loading: false,
        done: true,
        response: JSON.stringify(data, null, 2),
      }));
```

- [ ] **Step 8: Render the trace panel**

Replace:

```tsx
        <ResultArea message={globalResult} type={globalResultType} />
      </div>
    </main>
  );
}
```

with:

```tsx
        <ResultArea message={globalResult} type={globalResultType} />

        <ApiTraceLog entries={traceEntries} />
      </div>
    </main>
  );
}
```

- [ ] **Step 9: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS, zero errors.

- [ ] **Step 10: Manual check**

`pnpm dev`, open `/checkout-API`, run steps 1 through 4 in order, confirm each step still works exactly as before (auto-fill behavior unchanged) and the API Trace panel accumulates one entry per step (two for step 3).

- [ ] **Step 11: Commit**

```bash
git add src/app/checkout-API/page.tsx
git commit -m "$(cat <<'EOF'
feat[<today's date>]: checkout-API 四步流程接入 API trace 面板

## 主要改动
- src/app/checkout-API/page.tsx: 4 个 step 的现有 request/response 文本框
  UI 不变，额外把每一步调用的 trace（含 headers）汇总到页面底部的
  ApiTraceLog，弥补原 UI 看不到 headers 的问题
EOF
)"
```

---

### Task 12: Wire into `save-card`

**Files:**
- Modify: `src/app/save-card/page.tsx`

- [ ] **Step 1: Add imports**

```ts
import ApiTraceLog from "@/components/ApiTraceLog";
import { useApiTraceLog } from "@/hooks/useApiTraceLog";
import { extractTrace } from "@/lib/api-trace";
```

- [ ] **Step 2: Add the hook call**

Next to `const saveVaultResult = useVaultStore((s) => s.saveVaultResult);`:

```ts
  const { entries: traceEntries, pushTrace } = useApiTraceLog();
```

- [ ] **Step 3: Capture the init trace**

Replace:

```ts
  const handleInitLoaded = useCallback(
    (data: VaultInitData) => {
      setInitData(data);
      initDataRef.current = data;
      loadSdk(data);
    },
    [loadSdk]
  );
```

with:

```ts
  const handleInitLoaded = useCallback(
    (data: VaultInitData) => {
      setInitData(data);
      initDataRef.current = data;
      pushTrace(data.__trace || []);
      loadSdk(data);
    },
    [loadSdk, pushTrace]
  );
```

- [ ] **Step 4: Capture the setup-token trace**

Replace:

```ts
    const res = await fetch(
      `/api/vault/setup-token-card${qs ? `?${qs}` : ""}`,
      { headers: buildPayPalHeaders(initDataRef.current) }
    );
    const data = await res.json();
    return data.id;
  }, [showResult]);
```

with:

```ts
    const res = await fetch(
      `/api/vault/setup-token-card${qs ? `?${qs}` : ""}`,
      { headers: buildPayPalHeaders(initDataRef.current) }
    );
    const { data, trace } = extractTrace(await res.json());
    pushTrace(trace);
    return data.id;
  }, [showResult, pushTrace]);
```

- [ ] **Step 5: Capture the payment-token trace**

Replace:

```ts
      const res = await fetch(
        `/api/vault/payment-token?token_id=${data.vaultSetupToken}`,
        { headers: buildPayPalHeaders(initDataRef.current) }
      );
      const result = await res.json();

      const vaultId = result.id || "";
      const customerId = result.customer?.id || "";
```

with:

```ts
      const res = await fetch(
        `/api/vault/payment-token?token_id=${data.vaultSetupToken}`,
        { headers: buildPayPalHeaders(initDataRef.current) }
      );
      const { data: result, trace } = extractTrace(await res.json());
      pushTrace(trace);

      const vaultId = result.id || "";
      const customerId = result.customer?.id || "";
```

And update `onApprove`'s dependency array from:

```ts
    [showResult, isAuth, saveVaultResult]
  );
```

to:

```ts
    [showResult, isAuth, saveVaultResult, pushTrace]
  );
```

- [ ] **Step 6: Render the trace panel**

Replace:

```tsx
        <ResultArea message={resultMsg} type={resultType} />

        {initData && (
```

with:

```tsx
        <ResultArea message={resultMsg} type={resultType} />

        <ApiTraceLog entries={traceEntries} />

        {initData && (
```

- [ ] **Step 7: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS, zero errors.

- [ ] **Step 8: Manual check**

`pnpm dev`, open `/save-card`, complete the save-card flow, confirm the trace panel shows init + setup-token + payment-token entries.

- [ ] **Step 9: Commit**

```bash
git add src/app/save-card/page.tsx
git commit -m "$(cat <<'EOF'
feat[<today's date>]: save-card 接入 API trace 面板

## 主要改动
- src/app/save-card/page.tsx: init / setup-token-card / payment-token
  三类调用接入 useApiTraceLog，页面底部展示 ApiTraceLog
EOF
)"
```

---

### Task 13: Wire into `save-PayPal`

**Files:**
- Modify: `src/app/save-PayPal/page.tsx`

- [ ] **Step 1: Add imports**

```ts
import ApiTraceLog from "@/components/ApiTraceLog";
import { useApiTraceLog } from "@/hooks/useApiTraceLog";
import { extractTrace } from "@/lib/api-trace";
```

- [ ] **Step 2: Add the hook call**

Next to `const saveVaultResult = useVaultStore((s) => s.saveVaultResult);`:

```ts
  const { entries: traceEntries, pushTrace } = useApiTraceLog();
```

- [ ] **Step 3: Capture the init trace**

Replace:

```ts
  const handleInitLoaded = useCallback(
    (data: VaultInitData) => {
      initDataRef.current = data;
      loadSdk(data);
    },
    [loadSdk]
  );
```

with:

```ts
  const handleInitLoaded = useCallback(
    (data: VaultInitData) => {
      initDataRef.current = data;
      pushTrace(data.__trace || []);
      loadSdk(data);
    },
    [loadSdk, pushTrace]
  );
```

- [ ] **Step 4: Capture the setup-token trace**

Replace:

```ts
    const res = await fetch(`/api/vault/setup-token-paypal?${params}`, {
      headers: buildPayPalHeaders(initDataRef.current),
    });
    const data = await res.json();
    return data.id;
  }, [showResult]);
```

with:

```ts
    const res = await fetch(`/api/vault/setup-token-paypal?${params}`, {
      headers: buildPayPalHeaders(initDataRef.current),
    });
    const { data, trace } = extractTrace(await res.json());
    pushTrace(trace);
    return data.id;
  }, [showResult, pushTrace]);
```

- [ ] **Step 5: Capture the payment-token trace**

Replace:

```ts
      const res = await fetch(
        `/api/vault/payment-token?token_id=${data.vaultSetupToken}`,
        { headers: buildPayPalHeaders(initDataRef.current) }
      );
      const result = await res.json();

      const vaultId = result.id || "";
      const customerId = result.customer?.id || "";
```

with:

```ts
      const res = await fetch(
        `/api/vault/payment-token?token_id=${data.vaultSetupToken}`,
        { headers: buildPayPalHeaders(initDataRef.current) }
      );
      const { data: result, trace } = extractTrace(await res.json());
      pushTrace(trace);

      const vaultId = result.id || "";
      const customerId = result.customer?.id || "";
```

And update `onApprove`'s dependency array from:

```ts
    [showResult, isAuth, saveVaultResult]
  );
```

to:

```ts
    [showResult, isAuth, saveVaultResult, pushTrace]
  );
```

- [ ] **Step 6: Render the trace panel**

Replace:

```tsx
        <ResultArea message={resultMsg} type={resultType} />
      </div>
    </main>
  );
}
```

(the one inside `SavePayPalContent`, before the `ToggleOption` function) with:

```tsx
        <ResultArea message={resultMsg} type={resultType} />

        <ApiTraceLog entries={traceEntries} />
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS, zero errors.

- [ ] **Step 8: Manual check**

`pnpm dev`, open `/save-PayPal`, complete the save-PayPal flow, confirm the trace panel shows init + setup-token + payment-token entries.

- [ ] **Step 9: Commit**

```bash
git add src/app/save-PayPal/page.tsx
git commit -m "$(cat <<'EOF'
feat[<today's date>]: save-PayPal 接入 API trace 面板

## 主要改动
- src/app/save-PayPal/page.tsx: init / setup-token-paypal / payment-token
  三类调用接入 useApiTraceLog，页面底部展示 ApiTraceLog
EOF
)"
```

---

### Task 14: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS, zero errors, across the whole repo.

- [ ] **Step 2: Production build sanity check**

Run: `pnpm build`
Expected: build succeeds (this also catches anything `tsc --noEmit` alone might miss, like unused-import lint failures if `next build` runs eslint).

- [ ] **Step 3: Manual regression pass on the dev server**

Run `pnpm dev` and click through all 5 flows end to end, confirming for each: (a) the flow still completes successfully exactly as before, (b) the API Trace panel shows accurate entries, (c) no React console errors/warnings about missing dependencies in hooks (check the browser devtools console):

- `/checkout-ACDC` — both `model=firstTime` and `model=returning`
- `/checkout-PayPal` — both `model=firstTime` and `model=returning`
- `/checkout-API` — all 4 steps, both `card` and `paypal` source types
- `/save-card`
- `/save-PayPal`

- [ ] **Step 4: Double-click regression check**

On `/checkout-ACDC?model=returning...`, rapid-double-click "Pay with Saved Card" 3 times in a row. Confirm exactly one order is created and captured each time (check the API Trace panel entry count, or the PayPal sandbox dashboard order history).

- [ ] **Step 5: No commit needed for this task** — it's pure verification. If any issue is found, fix it as part of the task where it was introduced (amend that task's changes, not a generic "fix bugs" commit), then re-run this task's checks.
