# Checkout Card With PCI (Raw Card Number + Order API Vault) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new test page `/checkout-card-with-pci` that collects a raw card number via plain `<input>` elements (no PayPal SDK component), sends it directly in the Orders API request body to create+capture an order, vaults the card in the process, and lets returning buyers pay again using only the recorded `vault_id`.

**Architecture:** One new client page file mirroring the existing `checkout-ACDC/page.tsx` structure (same `VaultCommonPart` usage, same trace-log wiring, same first-time/returning split driven by the `model` query param), but replacing PayPal Card Fields with plain inputs and replacing the SDK `createOrder`/`onApprove` callback split with two sequential `fetch` calls (`POST /api/orders` → `POST /api/orders/[id]/capture`) inside one click handler. No backend routes change — `/api/orders` and `/api/orders/[orderID]/capture` already forward the request body as-is. A new entry is added to the dashboard's flow selector.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Zustand (existing `useVaultStore`).

**Note on verification:** This repo has no test runner (`package.json` has no jest/vitest/playwright). Existing pages are verified via `pnpm tsc --noEmit` (type safety) and manual browser testing against the sandbox (per `CLAUDE.md`'s `pnpm dev` command). This plan follows that same pattern instead of writing unit tests — there is no test harness to write tests against.

---

### Task 1: Create the `/checkout-card-with-pci` page

**Files:**
- Create: `src/app/checkout-card-with-pci/page.tsx`

- [ ] **Step 1: Write the full page file**

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useRef, useState, Suspense } from "react";
import VaultCommonPart, {
  type VaultCommonPartRef,
  type VaultInitData,
} from "@/components/VaultCommonPart";
import ResultArea, { type ResultType } from "@/components/ResultArea";
import CardCopyInfo from "@/components/CardCopyInfo";
import { useVaultStore } from "@/store/vault";
import { buildPayPalHeaders } from "@/lib/api-client";
import ApiTraceLog from "@/components/ApiTraceLog";
import { useApiTraceLog } from "@/hooks/useApiTraceLog";
import { extractTrace } from "@/lib/api-trace";

/** Converts the sandbox test card's "MM/YYYY" display format to the Orders API's "YYYY-MM". */
function toApiExpiry(mmYYYY: string): string {
  const [mm, yyyy] = mmYYYY.split("/");
  if (!mm || !yyyy) return mmYYYY;
  return `${yyyy}-${mm.padStart(2, "0")}`;
}

function CheckoutCardWithPciContent() {
  const searchParams = useSearchParams();
  const model = searchParams.get("model") || "firstTime";
  const isAuth = searchParams.get("is_use_PAYPAL_AUTH_ASSERTION") === "true";
  const isFirstTime = model === "firstTime";

  const saveVaultResult = useVaultStore((s) => s.saveVaultResult);
  const { entries: traceEntries, pushTrace } = useApiTraceLog();
  const vaultRef = useRef<VaultCommonPartRef>(null);
  const [initData, setInitData] = useState<VaultInitData | null>(null);
  const initDataRef = useRef<VaultInitData | null>(null);

  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  const [resultMsg, setResultMsg] = useState("Waiting for payment...");
  const [resultType, setResultType] = useState<ResultType>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [txnId, setTxnId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [vaultId, setVaultId] = useState("");
  const [savedCard, setSavedCard] = useState<{ last4: string; brand: string; expiry: string } | null>(null);

  const showResult = useCallback((msg: string, type: ResultType) => {
    setResultMsg(msg);
    setResultType(type);
  }, []);

  const handleInitLoaded = useCallback(
    (data: VaultInitData) => {
      setInitData(data);
      initDataRef.current = data;
      pushTrace(data.__trace || []);
      setCardNumber(data.PAYPAL_TEST_CARD_NO);
      setCardExpiry(toApiExpiry(data.PAYPAL_TEST_CARD_DATE));
      setCardCvv(data.PAYPAL_TEST_CARD_CVV);

      // Fetch saved card details for returning buyer (brand/last4/expiry display only)
      if (model === "returning" && data.VAULT_ID) {
        fetch(
          `/api/vault/paypal-api?endpoint=/v3/vault/payment-tokens/${data.VAULT_ID}&pathParam=`,
          { headers: buildPayPalHeaders(data) }
        )
          .then((r) => r.json())
          .then((d) => {
            const card = d?.payment_source?.card;
            if (card) {
              setSavedCard({
                last4: card.last_digits || "",
                brand: card.brand || "",
                expiry: card.expiry || "",
              });
            }
          })
          .catch((err) => {
            console.warn("[checkout-card-with-pci] Failed to fetch saved card details:", err);
          });
      }
    },
    [model, pushTrace]
  );

  const handlePay = async () => {
    if (isLoading || !initDataRef.current) return;
    const state = vaultRef.current?.getState();
    const orderAmount = state?.orderAmount || "100";
    const customerIdInput = state?.customerId || "";
    const useVault = state?.useVault || false;
    const payVaultId = state?.vaultId || "";

    setIsLoading(true);
    showResult("Creating order...", "info");

    const card: Record<string, unknown> =
      useVault && payVaultId
        ? { vault_id: payVaultId }
        : (() => {
            const c: Record<string, unknown> = {
              number: cardNumber,
              expiry: cardExpiry,
              security_code: cardCvv,
            };
            if (useVault) {
              const attributes: Record<string, unknown> = {
                vault: { store_in_vault: "ON_SUCCESS" },
              };
              if (customerIdInput) attributes.customer = { id: customerIdInput };
              c.attributes = attributes;
            }
            return c;
          })();

    const body = {
      intent: "CAPTURE",
      payment_source: { card },
      purchase_units: [{ amount: { currency_code: "USD", value: orderAmount } }],
    };

    try {
      const createRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
        body: JSON.stringify(body),
      });
      const { data: orderData, trace: createTrace } = extractTrace(await createRes.json());
      pushTrace(createTrace);

      if (!orderData.id) {
        showResult(`Error creating order: ${JSON.stringify(orderData, null, 2)}`, "error");
        setIsLoading(false);
        return;
      }

      // No SDK component to wait on (no CardFields onApprove) — capture immediately after create.
      showResult("Capturing payment...", "info");
      const captureRes = await fetch(`/api/orders/${orderData.id}/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
      });
      const { data: captureData, trace: captureTrace } = extractTrace(await captureRes.json());
      pushTrace(captureTrace);

      if (captureData.status === "COMPLETED" || captureData.status === "ORDER_ALREADY_COMPLETED") {
        const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
        const txn = capture?.id || captureData.id || "";
        const cid = captureData.payment_source?.card?.attributes?.vault?.customer?.id || "";
        const vid = captureData.payment_source?.card?.attributes?.vault?.id || "";

        setTxnId(txn);
        setCustomerId(cid);
        setVaultId(vid);
        if (cid || vid) saveVaultResult(isAuth, "card", cid, vid);
        showResult(`✓ Payment COMPLETED\nOrder: ${orderData.id}\nCapture: ${txn}`, "success");
      } else {
        showResult(`Error: ${JSON.stringify(captureData, null, 2)}`, "error");
      }
    } catch (err) {
      showResult(`Transaction failed: ${err}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <a href="/" className="text-slate-400 hover:text-slate-600 transition-colors text-sm">
            ← Dashboard
          </a>
          <span className="text-slate-200">/</span>
          <h1 className="text-xl font-black text-slate-900">Raw Card API Checkout</h1>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <VaultCommonPart
            ref={vaultRef}
            model={model}
            isUsePaypalAuthAssertion={isAuth}
            route="checkout-card-with-pci"
            showVaultOption={true}
            showOrderAmount={true}
            onInitDataLoaded={handleInitLoaded}
          />
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Card Details
          </h2>

          {!isFirstTime ? (
            <>
              {savedCard && (
                <div className="grid grid-cols-3 gap-3 pb-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Brand</span>
                    <span className="text-sm font-mono text-slate-700">{savedCard.brand || "—"}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Last 4</span>
                    <span className="text-sm font-mono text-slate-700">•••• {savedCard.last4 || "—"}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Expiry</span>
                    <span className="text-sm font-mono text-slate-700">{savedCard.expiry || "—"}</span>
                  </div>
                </div>
              )}
              <button
                onClick={handlePay}
                disabled={isLoading}
                className="w-full py-4 rounded-lg bg-emerald-600 hover:bg-emerald-700
                  text-white font-bold text-sm transition-all duration-150
                  disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
              >
                {isLoading ? "Processing..." : "Pay with Saved Card"}
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Card Number
                </label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4012000033330026"
                  className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-mono text-slate-700
                    focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Expiry (YYYY-MM)
                  </label>
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="2027-12"
                    className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-mono text-slate-700
                      focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    CVV
                  </label>
                  <input
                    type="text"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    placeholder="123"
                    className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-mono text-slate-700
                      focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                  />
                </div>
              </div>
              <button
                onClick={handlePay}
                disabled={isLoading || !initData}
                className="w-full py-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm
                  transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Processing..." : "Pay Now"}
              </button>
            </div>
          )}
        </div>

        <ResultArea message={resultMsg} type={resultType} />

        <ApiTraceLog entries={traceEntries} />

        {isFirstTime && (txnId || customerId || vaultId) && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Transaction Details
            </h2>
            <div className="space-y-3">
              <DetailField label="Transaction ID" value={txnId} />
              <DetailField label="Customer ID" value={customerId} />
              <DetailField label="Vault ID" value={vaultId} />
            </div>
          </div>
        )}

        {initData && (
          <CardCopyInfo
            cardNo={initData.PAYPAL_TEST_CARD_NO}
            cardDate={initData.PAYPAL_TEST_CARD_DATE}
            cardCvv={initData.PAYPAL_TEST_CARD_CVV}
          />
        )}
      </div>
    </main>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          readOnly
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-700"
        />
        <button
          onClick={copy}
          className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
        >
          {copied ? "✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function CheckoutCardWithPciPage() {
  return (
    <Suspense>
      <CheckoutCardWithPciContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors related to `src/app/checkout-card-with-pci/page.tsx`.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no errors/warnings for the new file (watch for `react-hooks/exhaustive-deps` on `handleInitLoaded`'s dependency array — it should only list `model` and `pushTrace`, matching the code above).

- [ ] **Step 4: Commit**

```bash
git add src/app/checkout-card-with-pci/page.tsx
git commit -m "$(cat <<'EOF'
feat[2026-10-20]: 新增原始卡号直传Order API的vault测试页

## 解决的问题
新增一个不依赖PayPal Card Fields组件的信用卡测试case：前端用普通input收集卡号，后端直接把原始卡数据传给Order API创建并捕获订单，期间把卡vault化；返回用户用记录的vault_id直接支付，无需重新输卡号。

## 主要改动
- src/app/checkout-card-with-pci/page.tsx: 新增页面，首次买家路径展示原始卡号/有效期/CVV输入框（预填沙箱测试卡），点击后连续调用 POST /api/orders 和 POST /api/orders/[id]/capture（无SDK回调分隔两步）；返回买家路径隐藏输入框，展示已存卡摘要并直接用vault_id支付；复用VaultCommonPart/ResultArea/ApiTraceLog/CardCopyInfo等既有组件

## 为什么这么改
不新增/修改后端路由——/api/orders和/api/orders/[orderID]/capture已原样转发请求体，足以支撑该case；页面结构照搬checkout-ACDC以保持一致的vault/trace模式，只替换Card Fields为原始input，并把两步API调用改为同步连续执行（因为没有SDK的onApprove回调来分隔）
EOF
)"
```

---

### Task 2: Add dashboard entry

**Files:**
- Modify: `src/app/page.tsx:23-65` (the `flows` array)

- [ ] **Step 1: Add the new flow entry**

In `src/app/page.tsx`, add a new object to the `flows` array, right after the `checkout-PayPal` entry (so it stays in the "With Purchase" section, keeping the same `blue` color as the other `with_purchase` flows):

```ts
    {
        id: "checkout-PayPal",
        label: "PayPal Button",
        description: "Smart Payment Button with PayPal vault",
        icon: "🅿",
        category: "with_purchase",
        color: "blue",
    },
    {
        id: "checkout-card-with-pci",
        label: "Raw Card API",
        description: "Collect card number directly (no SDK), vault via Order API",
        icon: "🔓",
        category: "with_purchase",
        color: "blue",
    },
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual browser verification**

Run: `pnpm dev`, open `http://localhost:3000`.

1. Confirm a "Raw Card API" card now appears in the "With Purchase" section, between "ACDC Card" and "PayPal Button".
2. Select a 1st Party app (or 3rd Party), leave Buyer Type as "First Time", click the new card — it should navigate to `/checkout-card-with-pci?model=firstTime&is_use_PAYPAL_AUTH_ASSERTION=...`.
3. On that page: check the "Use Vault ID to Pay" checkbox under the Vault panel, verify the Card Number/Expiry/CVV inputs are pre-filled with the sandbox test card, click "Pay Now". Confirm:
   - `ApiTraceLog` shows a `POST /v2/checkout/orders` entry followed by a `POST /v2/checkout/orders/{id}/capture` entry.
   - `ResultArea` shows `✓ Payment COMPLETED`.
   - A "Transaction Details" section appears with Transaction ID / Customer ID / Vault ID filled in.
4. Go back to the dashboard, switch Buyer Type to "Returning", click "Raw Card API" again. Confirm:
   - The card number/expiry/CVV inputs are NOT shown.
   - A saved-card summary (brand/last4/expiry) is shown instead.
   - Clicking "Pay with Saved Card" succeeds and shows `✓ Payment COMPLETED` using only the `vault_id` (no raw card data in the create-order trace request body).

If any step fails, fix the page code from Task 1 before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat[2026-10-20]: dashboard新增Raw Card API入口

## 解决的问题
新增的/checkout-card-with-pci页面需要一个dashboard入口才能被测试者发现和访问。

## 主要改动
- src/app/page.tsx: flows数组新增"Raw Card API"卡片，归入With Purchase分类，指向/checkout-card-with-pci
EOF
)"
```
