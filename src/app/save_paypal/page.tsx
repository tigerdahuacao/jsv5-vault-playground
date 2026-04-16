"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import VaultCommonPart, {
  type VaultCommonPartRef,
  type VaultInitData,
} from "@/components/VaultCommonPart";
import ResultArea, { type ResultType } from "@/components/ResultArea";
import { useVaultStore } from "@/store/vault";
import { cn } from "@/lib/utils";


function SavePayPalContent() {
  const searchParams = useSearchParams();
  const model = searchParams.get("model") || "firstTime";
  const isAuth = searchParams.get("is_use_PAYPAL_AUTH_ASSERTION") === "true";

  const saveVaultResult = useVaultStore((s) => s.saveVaultResult);
  const vaultRef = useRef<VaultCommonPartRef>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [resultMsg, setResultMsg] = useState("Waiting...");
  const [resultType, setResultType] = useState<ResultType>("idle");

  const showResult = useCallback((msg: string, type: ResultType) => {
    setResultMsg(msg);
    setResultType(type);
  }, []);

  const loadSdk = useCallback((data: VaultInitData) => {
    if (!data.clientId) return;
    const existing = document.getElementById("paypal-sdk-script");
    if (existing) existing.remove();
    setSdkReady(false);

    const script = document.createElement("script");
    script.id = "paypal-sdk-script";
    script.src = `https://www.paypal.com/sdk/js?client-id=${data.clientId}&components=buttons&vault=true&currency=USD`;
    if (data.id_token) script.setAttribute("data-user-id-token", data.id_token);
    script.onload = () => setSdkReady(true);
    document.head.appendChild(script);
  }, []);

  const createVaultSetupToken = useCallback(async () => {
    showResult("Creating setup token for PayPal...", "info");
    const res = await fetch("/api/vault/setup-token-paypal");
    const data = await res.json();
    return data.id;
  }, [showResult]);

  const onApprove = useCallback(
    async (data: { vaultSetupToken: string }) => {
      showResult("Creating payment token...", "info");
      const res = await fetch(
        `/api/vault/payment-token?token_id=${data.vaultSetupToken}`
      );
      const result = await res.json();

      const vaultId = result.id || "";
      const customerId = result.customer?.id || "";
      if (vaultId || customerId) saveVaultResult(isAuth, customerId, vaultId);
      showResult(
        `✓ PayPal Saved!\nVault ID: ${vaultId}\nCustomer ID: ${customerId}`,
        "success"
      );
    },
    [showResult, isAuth, saveVaultResult]
  );

  useEffect(() => {
    if (!sdkReady || !window.paypal?.Buttons) return;

    const container = document.getElementById("paypal-button-container");
    if (container) container.innerHTML = "";

    window.paypal
      .Buttons({
        createVaultSetupToken,
        onApprove,
        onError: (err: unknown) => showResult(`Error: ${err}`, "error"),
      })
      .render("#paypal-button-container");
  }, [sdkReady, createVaultSetupToken, onApprove, showResult]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <a href="/" className="text-slate-400 hover:text-slate-600 transition-colors text-sm">
            ← Dashboard
          </a>
          <span className="text-slate-200">/</span>
          <h1 className="text-xl font-black text-slate-900">Save PayPal (No Purchase)</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
          <VaultCommonPart
            ref={vaultRef}
            model={model}
            isUsePaypalAuthAssertion={isAuth}
            route="save_paypal"
            showVaultOption={false}
            showOrderAmount={false}
            onInitDataLoaded={loadSdk}
          />
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            PayPal Smart Button
          </h2>
          {!sdkReady && (
            <div className="h-14 flex items-center justify-center text-slate-400 text-sm animate-pulse">
              Loading PayPal SDK...
            </div>
          )}
          <div
            id="paypal-button-container"
            className={cn(sdkReady ? "block" : "hidden", "min-h-[50px]")}
          />
        </div>

        <ResultArea message={resultMsg} type={resultType} />
      </div>
    </main>
  );
}

export default function SavePayPalPage() {
  return (
    <Suspense>
      <SavePayPalContent />
    </Suspense>
  );
}
