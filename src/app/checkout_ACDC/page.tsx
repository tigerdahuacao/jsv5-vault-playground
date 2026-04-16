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


function CheckoutACDCContent() {
  const searchParams = useSearchParams();
  const model = searchParams.get("model") || "firstTime";
  const isAuth = searchParams.get("is_use_PAYPAL_AUTH_ASSERTION") === "true";

  const saveVaultResult = useVaultStore((s) => s.saveVaultResult);
  const vaultRef = useRef<VaultCommonPartRef>(null);
  const [initData, setInitData] = useState<VaultInitData | null>(null);
  const [isVaultSave, setIsVaultSave] = useState(false);
  const [isWith3DS, setIsWith3DS] = useState(false);
  const [resultMsg, setResultMsg] = useState("Waiting for payment...");
  const [resultType, setResultType] = useState<ResultType>("idle");
  const [txnId, setTxnId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [vaultId, setVaultId] = useState("");
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
      loadSdk(data);
    },
    [loadSdk]
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

    if (isVaultSave && !useVault) {
      cardAttrs["vault"] = { store_in_vault: "ON_SUCCESS" };
    }
    if (isWith3DS) {
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

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.id;
  }, [isVaultSave, isWith3DS]);

  const onApproveCallback = useCallback(async (data: { orderID: string }) => {
    showResult("Processing payment...", "info");
    const res = await fetch(`/api/orders/${data.orderID}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      if (cid || vid) saveVaultResult(isAuth, cid, vid);
      showResult(`✓ Payment COMPLETED\nOrder: ${data.orderID}\nCapture: ${txn}`, "success");
    } else {
      showResult(`Error: ${JSON.stringify(captureData, null, 2)}`, "error");
    }
  }, [showResult, isAuth, saveVaultResult]);

  // Initialize card fields once SDK is ready
  useEffect(() => {
    if (!sdkReady || !window.paypal?.CardFields) return;

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

  const handlePay = () => {
    if (!cardFieldRef.current) return;
    cardFieldRef.current
      .submit()
      .catch((err: unknown) =>
        showResult(`Transaction failed: ${err}`, "error")
      );
  };

  const isFirstTime = model === "firstTime";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-10 px-4">
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
            />
            <ToggleOption
              id="with3DS"
              checked={isWith3DS}
              onChange={setIsWith3DS}
              label="With 3DS"
              description="SCA_ALWAYS verification"
              activeColor="violet"
            />
          </div>
        </div>

        {/* Card Fields */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Card Details
          </h2>

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
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  activeColor: "blue" | "violet";
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
        "flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-200",
        checked
          ? active[activeColor]
          : "border-slate-200 bg-white hover:border-slate-300"
      )}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
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
