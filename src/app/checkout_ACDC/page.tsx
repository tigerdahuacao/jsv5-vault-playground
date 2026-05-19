"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { usePaypalSdk } from "@/hooks/usePaypalSdk";
import VaultCommonPart, {
  type VaultCommonPartRef,
  type VaultInitData,
} from "@/components/VaultCommonPart";
import ResultArea, { type ResultType } from "@/components/ResultArea";
import CardCopyInfo from "@/components/CardCopyInfo";
import { useVaultStore } from "@/store/vault";
import { cn } from "@/lib/utils";
import { buildPayPalHeaders } from "@/lib/api-client";


function CheckoutACDCContent() {
  const searchParams = useSearchParams();
  const model = searchParams.get("model") || "firstTime";
  const isAuth = searchParams.get("is_use_PAYPAL_AUTH_ASSERTION") === "true";

  const saveVaultResult = useVaultStore((s) => s.saveVaultResult);
  const vaultRef = useRef<VaultCommonPartRef>(null);
  const [initData, setInitData] = useState<VaultInitData | null>(null);
  const initDataRef = useRef<VaultInitData | null>(null);
  const [isVaultSave, setIsVaultSave] = useState(false);
  const [isWith3DS, setIsWith3DS] = useState(false);
  const isVaultSaveRef = useRef(false);
  const isWith3DSRef = useRef(false);
  const [resultMsg, setResultMsg] = useState("Waiting for payment...");
  const [resultType, setResultType] = useState<ResultType>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [txnId, setTxnId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [vaultId, setVaultId] = useState("");
  const [savedCard, setSavedCard] = useState<{ last4: string; brand: string; expiry: string } | null>(null);
  // Keep refs in sync so createOrderCallback reads latest values without being recreated
  useEffect(() => { isVaultSaveRef.current = isVaultSave; }, [isVaultSave]);
  useEffect(() => { isWith3DSRef.current = isWith3DS; }, [isWith3DS]);

  const showResult = useCallback((msg: string, type: ResultType) => {
    setResultMsg(msg);
    setResultType(type);
  }, []);

  const { sdkReady, loadSdk, cardFieldInstanceRef } = usePaypalSdk({
    components: "card-fields",
    onError: (msg) => showResult(msg, "error"),
  });
  // Alias for CardFields instance storage
  const cardFieldRef = cardFieldInstanceRef as React.MutableRefObject<ReturnType<typeof window.paypal.CardFields> | null>;

  const handleInitLoaded = useCallback(
    (data: VaultInitData) => {
      setInitData(data);
      initDataRef.current = data;
      loadSdk(data);
      // Fetch saved card details for returning buyer
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
            console.warn("[checkout_ACDC] Failed to fetch saved card details:", err);
          });
      }
    },
    [loadSdk, model]
  );

  const createOrderCallback = useCallback(async () => {
    const state = vaultRef.current?.getState();
    const orderAmount = state?.orderAmount || "100";
    const customerId = state?.customerId || "";
    const useVault = state?.useVault || false;
    const vaultId = state?.vaultId || "";

    const payment_source: Record<string, unknown> = {
      card: {
        attributes: {} as Record<string, unknown>,
        experience_context: {
          shipping_preference: "NO_SHIPPING",
          return_url: "https://example.com/returnUrl",
          cancel_url: "https://example.com/cancelUrl",
        },
      },
    };

    const cardAttrs = (payment_source.card as Record<string, unknown>)
      .attributes as Record<string, unknown>;

    if (isVaultSaveRef.current && !useVault) {
      cardAttrs["vault"] = { store_in_vault: "ON_SUCCESS" };
    }
    if (isWith3DSRef.current) {
      cardAttrs["verification"] = { method: "SCA_ALWAYS" };
    }
    if (customerId) {
      cardAttrs["customer"] = { id: customerId };
    }
    if (useVault && vaultId) {
      (payment_source.card as Record<string, unknown>)["vault_id"] = vaultId;
      delete (payment_source.card as Record<string, unknown>)["attributes"];
    }

    const body = {
      intent: "CAPTURE",
      payment_source,
      purchase_units: [{ amount: { currency_code: "USD", value: orderAmount } }],
    };

    if (!initDataRef.current) return "";
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.id;
  }, []);

  const onApproveCallback = useCallback(async (data: { orderID: string }) => {
    setIsLoading(true);
    showResult("Processing payment...", "info");
    if (!initDataRef.current) return;
    const res = await fetch(`/api/orders/${data.orderID}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
    });
    const captureData = await res.json();

    if (captureData.status === "COMPLETED" || captureData.status === "ORDER_ALREADY_COMPLETED") {
      const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
      const txn = capture?.id || captureData.id || "";
      const cid =
        captureData.payment_source?.card?.attributes?.vault?.customer?.id || "";
      const vid = captureData.payment_source?.card?.attributes?.vault?.id || "";

      setTxnId(txn);
      setCustomerId(cid);
      setVaultId(vid);
      if (cid || vid) saveVaultResult(isAuth, "card", cid, vid);
      showResult(`✓ Payment COMPLETED\nOrder: ${data.orderID}\nCapture: ${txn}`, "success");
    } else {
      showResult(`Error: ${JSON.stringify(captureData, null, 2)}`, "error");
    }
    setIsLoading(false);
  }, [showResult, isAuth, saveVaultResult]);

  // Initialize card fields once SDK is ready — skip for returning buyers (no card entry needed)
  useEffect(() => {
    if (!sdkReady || !window.paypal?.CardFields || !isFirstTime) return;

    const cardField = window.paypal.CardFields({
      createOrder: createOrderCallback,
      onApprove: onApproveCallback,
      onError: (err: unknown) => showResult(`Error: ${err}`, "error"),
      style: {
        "input": {
          "height": "44px",
          "padding": "0 12px",
          "font-size": "14px",
          "font-family": "ui-sans-serif, system-ui, sans-serif",
          "color": "#1e293b",
        },
        ".invalid": { "color": "#e11d48" },
      },
    });
    cardFieldRef.current = cardField;

    if (cardField.isEligible()) {
      cardField.NameField().render("#card-name-field-container");
      cardField.NumberField().render("#card-number-field-container");
      cardField.CVVField().render("#card-cvv-field-container");
      cardField.ExpiryField().render("#card-expiry-field-container");
    }
  }, [sdkReady, createOrderCallback, onApproveCallback, showResult]);

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

    if (!cardFieldRef.current) return;
    setIsLoading(true);
    cardFieldRef.current
      .submit()
      .catch((err: unknown) => {
        setIsLoading(false);
        showResult(`Transaction failed: ${err}`, "error");
      });
  };

  const isFirstTime = model === "firstTime";

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-10 px-4">
      {/* Loading overlay */}
      {isLoading && overlayEnabled && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4">
            <svg className="w-10 h-10 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm font-semibold text-slate-700">Processing payment…</p>
            <p className="text-xs text-slate-400">Please do not close this page</p>
          </div>
        </div>
      )}
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <a href="/" className="text-slate-400 hover:text-slate-600 transition-colors text-sm">
            ← Dashboard
          </a>
          <span className="text-slate-200">/</span>
          <h1 className="text-xl font-black text-slate-900">ACDC Card Checkout</h1>
        </div>

        {/* Vault Common Part */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
          <VaultCommonPart
            ref={vaultRef}
            model={model}
            isUsePaypalAuthAssertion={isAuth}
            route="checkout_ACDC"
            showVaultOption={true}
            showOrderAmount={true}
            onInitDataLoaded={handleInitLoaded}
          />
        </div>

        {/* Vault + 3DS Options */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Payment Options
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <ToggleOption
              id="save_2_vault"
              checked={isVaultSave}
              onChange={setIsVaultSave}
              label="Save to Vault"
              description="Store card for future use"
              activeColor="blue"
              disabled={!isFirstTime}
            />
            <ToggleOption
              id="with3DS"
              checked={isWith3DS}
              onChange={(v) => {
                setIsWith3DS(v);
                setOverlayEnabled(!v);
              }}
              label="With 3DS"
              description="SCA_ALWAYS verification"
              activeColor="violet"
            />
            <ToggleOption
              id="overlay_enabled"
              checked={overlayEnabled}
              onChange={setOverlayEnabled}
              label="Loading Overlay"
              description={isWith3DS ? "Disabled — 3DS needs interaction" : "Show mask while processing"}
              activeColor="blue"
              disabled={isWith3DS}
            />
          </div>
        </div>

        {/* Saved card info — returning buyer only */}
        {!isFirstTime && savedCard && (
          <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 p-6 space-y-3">
            <h2 className="text-xs font-bold text-emerald-600 uppercase tracking-widest">
              Saved Card
            </h2>
            <div className="grid grid-cols-3 gap-3">
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
          </div>
        )}

        {/* Card Fields */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Card Details
          </h2>

          {!isFirstTime ? (
            /* Returning buyer — pay directly with vaulted card */
            <button
              onClick={handlePay}
              className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]
                text-white font-bold text-sm shadow-lg shadow-emerald-200 transition-all duration-200
                flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Pay with Saved Card
            </button>
          ) : (
            <>
              {!sdkReady && (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm animate-pulse">
                  Loading PayPal SDK...
                </div>
              )}
              <div id="card-form" className={sdkReady ? "space-y-4" : "hidden"}>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Cardholder Name
              </label>
              <div
                id="card-name-field-container"
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Card Number
              </label>
              <div
                id="card-number-field-container"
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Expiry Date
                </label>
                <div
                  id="card-expiry-field-container"
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  CVV
                </label>
                <div
                  id="card-cvv-field-container"
                  className="h-11"
                />
              </div>
            </div>

            <button
              id="multi-card-field-button"
              onClick={handlePay}
              disabled={!sdkReady}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-sm
                shadow-lg shadow-blue-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pay Now
            </button>
          </div>
            </>
          )}
        </div>

        {/* Result */}
        <ResultArea message={resultMsg} type={resultType} />

        {/* Transaction Details — shown after first-time vault save */}
        {isFirstTime && (txnId || customerId || vaultId) && (
          <div
            id="first_time_result_area"
            className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 space-y-4"
          >
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

        {/* Test Card */}
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

function ToggleOption({
  id,
  checked,
  onChange,
  label,
  description,
  activeColor,
  disabled = false,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  activeColor: "blue" | "violet";
  disabled?: boolean;
}) {
  const active = {
    blue: "border-blue-500 bg-blue-50",
    violet: "border-violet-500 bg-violet-50",
  };
  const dot = { blue: "bg-blue-500", violet: "bg-violet-500" };
  const text = { blue: "text-blue-700", violet: "text-violet-700" };

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200",
        disabled
          ? "border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed"
          : cn(
              "cursor-pointer",
              checked ? active[activeColor] : "border-slate-200 bg-white hover:border-slate-300"
            )
      )}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only"
      />
      <div
        className={cn(
          "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
          checked ? `${dot[activeColor]} border-transparent` : "border-slate-300"
        )}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div>
        <p className={cn("text-sm font-semibold", checked ? text[activeColor] : "text-slate-700")}>
          {label}
        </p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
    </label>
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
          className={cn(
            "px-3 py-2 rounded-lg text-xs font-medium transition-all",
            copied ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          )}
        >
          {copied ? "✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function CheckoutACDCPage() {
  return (
    <Suspense>
      <CheckoutACDCContent />
    </Suspense>
  );
}
