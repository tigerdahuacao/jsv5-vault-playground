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

    // "Use Vault ID to Pay" is disabled for first-time buyers (see VaultCommonPart) —
    // it only applies to returning buyers paying with an existing vault_id. For a
    // first-time purchase there is no opt-out: the whole point of this flow is to
    // vault the raw card during the purchase so a vault_id/customer_id come back
    // from capture and the returning-buyer path has something to pay with.
    const card: Record<string, unknown> =
      useVault && payVaultId
        ? { vault_id: payVaultId }
        : (() => {
            const c: Record<string, unknown> = {
              number: cardNumber,
              expiry: cardExpiry,
              security_code: cardCvv,
            };
            const attributes: Record<string, unknown> = {
              vault: { store_in_vault: "ON_SUCCESS" },
            };
            if (customerIdInput) attributes.customer = { id: customerIdInput };
            c.attributes = attributes;
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
        // Sandbox test cards (no 3DS) often complete the order synchronously during
        // creation. In that case captureOrder() short-circuits with a bare
        // { status: "ORDER_ALREADY_COMPLETED" } and the real capture/vault data only
        // exists on the create-order response — fall back to it.
        const source = captureData.status === "ORDER_ALREADY_COMPLETED" ? orderData : captureData;
        const capture = source.purchase_units?.[0]?.payments?.captures?.[0];
        const txn = capture?.id || source.id || "";
        const cid = source.payment_source?.card?.attributes?.vault?.customer?.id || "";
        const vid = source.payment_source?.card?.attributes?.vault?.id || "";

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
