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
import { buildPayPalHeaders } from "@/lib/api-client";


function SaveCardContent() {
  const searchParams = useSearchParams();
  const model = searchParams.get("model") || "firstTime";
  const isAuth = searchParams.get("is_use_PAYPAL_AUTH_ASSERTION") === "true";

  const saveVaultResult = useVaultStore((s) => s.saveVaultResult);
  const vaultRef = useRef<VaultCommonPartRef>(null);
  const [initData, setInitData] = useState<VaultInitData | null>(null);
  const initDataRef = useRef<VaultInitData | null>(null);
  const [resultMsg, setResultMsg] = useState("Waiting...");
  const [resultType, setResultType] = useState<ResultType>("idle");
  const showResult = useCallback((msg: string, type: ResultType) => {
    setResultMsg(msg);
    setResultType(type);
  }, []);

  const { sdkReady, loadSdk, cardFieldInstanceRef } = usePaypalSdk({
    components: "card-fields",
    onError: (msg) => showResult(msg, "error"),
  });
  const cardFieldRef = cardFieldInstanceRef as React.MutableRefObject<ReturnType<typeof window.paypal.CardFields> | null>;

  const handleInitLoaded = useCallback(
    (data: VaultInitData) => {
      setInitData(data);
      initDataRef.current = data;
      loadSdk(data);
    },
    [loadSdk]
  );

  const createVaultSetupToken = useCallback(async () => {
    showResult("Creating setup token...", "info");
    if (!initDataRef.current) return "";
    const res = await fetch("/api/vault/setup-token-card", {
      headers: buildPayPalHeaders(initDataRef.current),
    });
    const data = await res.json();
    return data.id;
  }, [showResult]);

  const onApprove = useCallback(
    async (data: { vaultSetupToken: string }) => {
      showResult("Creating payment token...", "info");
      if (!initDataRef.current) return;
      const res = await fetch(
        `/api/vault/payment-token?token_id=${data.vaultSetupToken}`,
        { headers: buildPayPalHeaders(initDataRef.current) }
      );
      const result = await res.json();

      const vaultId = result.id || "";
      const customerId = result.customer?.id || "";
      if (vaultId || customerId) saveVaultResult(isAuth, "card", customerId, vaultId);
      showResult(
        `✓ Card Saved!\nVault ID: ${vaultId}\nCustomer ID: ${customerId}`,
        "success"
      );
    },
    [showResult, isAuth, saveVaultResult]
  );

  useEffect(() => {
    if (!sdkReady || !window.paypal?.CardFields) return;

    const cardField = window.paypal.CardFields({
      createVaultSetupToken,
      onApprove,
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
  }, [sdkReady, createVaultSetupToken, onApprove, showResult]);

  const handleSave = () => {
    cardFieldRef.current?.submit().catch((err: unknown) =>
      showResult(`Failed: ${err}`, "error")
    );
  };

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <a href="/" className="text-slate-400 hover:text-slate-600 transition-colors text-sm">
            ← Dashboard
          </a>
          <span className="text-slate-200">/</span>
          <h1 className="text-xl font-black text-slate-900">Save Card (No Purchase)</h1>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <VaultCommonPart
            ref={vaultRef}
            model={model}
            isUsePaypalAuthAssertion={isAuth}
            route="save-card"
            showVaultOption={false}
            showOrderAmount={false}
            onInitDataLoaded={handleInitLoaded}
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
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
              <div id="card-name-field-container" className="h-11" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Card Number
              </label>
              <div id="card-number-field-container" className="h-11" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Expiry Date
                </label>
                <div id="card-expiry-field-container" className="h-11" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  CVV
                </label>
                <div id="card-cvv-field-container" className="h-11" />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={!sdkReady}
              className="w-full py-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm
                transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Card to Vault
            </button>
          </div>
        </div>

        <ResultArea message={resultMsg} type={resultType} />

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

export default function SaveCardPage() {
  return (
    <Suspense>
      <SaveCardContent />
    </Suspense>
  );
}
