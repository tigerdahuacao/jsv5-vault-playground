"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { usePaypalSdk } from "@/hooks/usePaypalSdk";
import VaultCommonPart, {
  type VaultCommonPartRef,
  type VaultInitData,
} from "@/components/VaultCommonPart";
import ResultArea, { type ResultType } from "@/components/ResultArea";
import { useVaultStore } from "@/store/vault";
import { cn } from "@/lib/utils";
import { buildPayPalHeaders } from "@/lib/api-client";


function SavePayPalContent() {
  const searchParams = useSearchParams();
  const model = searchParams.get("model") || "firstTime";
  const isAuth = searchParams.get("is_use_PAYPAL_AUTH_ASSERTION") === "true";

  const saveVaultResult = useVaultStore((s) => s.saveVaultResult);
  const vaultRef = useRef<VaultCommonPartRef>(null);
  const initDataRef = useRef<VaultInitData | null>(null);
  const [permitMultipleTokens, setPermitMultipleTokens] = useState(false);
  const permitMultipleTokensRef = useRef(false);
  const [merchantCustomerId, setMerchantCustomerId] = useState("");
  const merchantCustomerIdRef = useRef("");
  const [resultMsg, setResultMsg] = useState("Waiting...");
  const [resultType, setResultType] = useState<ResultType>("idle");
  useEffect(() => { permitMultipleTokensRef.current = permitMultipleTokens; }, [permitMultipleTokens]);
  useEffect(() => { merchantCustomerIdRef.current = merchantCustomerId; }, [merchantCustomerId]);

  const showResult = useCallback((msg: string, type: ResultType) => {
    setResultMsg(msg);
    setResultType(type);
  }, []);

  const { sdkReady, loadSdk } = usePaypalSdk({
    components: "buttons",
    extraParams: "&vault=true",
    onError: (msg) => showResult(msg, "error"),
  });

  const handleInitLoaded = useCallback(
    (data: VaultInitData) => {
      initDataRef.current = data;
      loadSdk(data);
    },
    [loadSdk]
  );

  const createVaultSetupToken = useCallback(async () => {
    showResult("Creating setup token for PayPal...", "info");
    if (!initDataRef.current) return "";
    const params = new URLSearchParams();
    if (permitMultipleTokensRef.current) params.set("permit_multiple_payment_tokens", "true");
    if (merchantCustomerIdRef.current) {
      params.set("merchant_customer_id", merchantCustomerIdRef.current);
    }
    const res = await fetch(`/api/vault/setup-token-paypal?${params}`, {
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
      if (vaultId || customerId) saveVaultResult(isAuth, "paypal", customerId, vaultId);
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
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <a href="/" className="text-slate-400 hover:text-slate-600 transition-colors text-sm">
            ← Dashboard
          </a>
          <span className="text-slate-200">/</span>
          <h1 className="text-xl font-black text-slate-900">Save PayPal (No Purchase)</h1>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <VaultCommonPart
            ref={vaultRef}
            model={model}
            isUsePaypalAuthAssertion={isAuth}
            route="save-PayPal"
            showVaultOption={false}
            showOrderAmount={false}
            onInitDataLoaded={handleInitLoaded}
          />
        </div>

        {/* Payment Options */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Payment Options
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <ToggleOption
              id="permit_multiple_tokens"
              checked={permitMultipleTokens}
              onChange={setPermitMultipleTokens}
              label="Multiple Payment Tokens"
              description="permit_multiple_payment_tokens"
              activeColor="blue"
            />
          </div>
          <div className="flex flex-col gap-1.5 pt-2">
            <label
              htmlFor="merchant_customer_id"
              className="text-xs font-semibold text-slate-500 uppercase tracking-wider"
            >
              Merchant Customer ID
              <span className="ml-2 normal-case font-normal text-slate-400">
                (optional · payment_source.paypal.customer.merchant_customer_id)
              </span>
            </label>
            <input
              id="merchant_customer_id"
              type="text"
              value={merchantCustomerId}
              onChange={(e) => setMerchantCustomerId(e.target.value)}
              placeholder="Your own customer identifier (free text)"
              className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700
                focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition-all"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
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
  const active = { blue: "border-blue-500 bg-blue-50", violet: "border-violet-500 bg-violet-50" };
  const dot = { blue: "bg-blue-500", violet: "bg-violet-500" };
  const text = { blue: "text-blue-700", violet: "text-violet-700" };
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all duration-200",
        disabled
          ? "border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed"
          : cn("cursor-pointer", checked ? active[activeColor] : "border-slate-200 bg-white hover:border-slate-300")
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
        <p className={cn("text-sm font-semibold", checked ? text[activeColor] : "text-slate-700")}>{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
    </label>
  );
}

export default function SavePayPalPage() {
  return (
    <Suspense>
      <SavePayPalContent />
    </Suspense>
  );
}
