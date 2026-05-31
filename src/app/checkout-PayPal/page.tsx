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


function CheckoutPayPalContent() {
  const searchParams = useSearchParams();
  const model = searchParams.get("model") || "firstTime";
  const isAuth = searchParams.get("is_use_PAYPAL_AUTH_ASSERTION") === "true";

  const saveVaultResult = useVaultStore((s) => s.saveVaultResult);
  const vaultRef = useRef<VaultCommonPartRef>(null);
  const [initData, setInitData] = useState<VaultInitData | null>(null);
  const initDataRef = useRef<VaultInitData | null>(null);
  const [permitMultipleTokens, setPermitMultipleTokens] = useState(false);
  const permitMultipleTokensRef = useRef(false);
  const [resultMsg, setResultMsg] = useState("Waiting for payment...");
  const [resultType, setResultType] = useState<ResultType>("idle");
  useEffect(() => { permitMultipleTokensRef.current = permitMultipleTokens; }, [permitMultipleTokens]);

  const showResult = useCallback((msg: string, type: ResultType) => {
    setResultMsg(msg);
    setResultType(type);
  }, []);

  const { sdkReady, loadSdk } = usePaypalSdk({
    components: "buttons",
    onError: (msg) => showResult(msg, "error"),
  });

  const handleInitLoaded = useCallback(
    (data: VaultInitData) => {
      setInitData(data);
      initDataRef.current = data;
      loadSdk(data);
    },
    [loadSdk]
  );

  const createOrder = useCallback(async () => {
    const state = vaultRef.current?.getState();
    const orderAmount = state?.orderAmount || "100";
    const customerId = state?.customerId || "";
    const useVault = state?.useVault || false;
    const vaultId = state?.vaultId || "";

    if (!initDataRef.current) return "";
    await fetch("/api/vault/store-params", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
      body: JSON.stringify({ isVaultSave: true, isCard: false }),
    });

    const vaultAttr = useVault
      ? undefined
      : {
          store_in_vault: "ON_SUCCESS",
          usage_type: "MERCHANT",
          ...(permitMultipleTokensRef.current ? { permit_multiple_payment_tokens: true } : {}),
        };

    const payment_source: Record<string, unknown> = {
      paypal: {
        attributes: {
          vault: vaultAttr,
          customer: customerId ? { id: customerId } : undefined,
        },
        experience_context: {
          shipping_preference: "NO_SHIPPING",
          return_url: "https://example.com/returnUrl",
          cancel_url: "https://example.com/cancelUrl",
          brand_name: "Vault Test App",
          locale: "en-US",
        },
      },
    };

    if (useVault && vaultId) {
      (payment_source.paypal as Record<string, unknown>)["vault_id"] = vaultId;
    }

    const body = {
      intent: "CAPTURE",
      payment_source,
      purchase_units: [
        {
          amount: { currency_code: "USD", value: orderAmount },
          shipping: {
            name: { full_name: "Test Buyer" },
            address: {
              address_line_1: "2211 N First Street",
              admin_area_2: "San Jose",
              admin_area_1: "CA",
              postal_code: "95131",
              country_code: "US",
            },
          },
        },
      ],
    };

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.id;
  }, []);

  const onApprove = useCallback(
    async (data: { orderID: string }) => {
      showResult("Processing payment...", "info");
      if (!initDataRef.current) return;
      const res = await fetch(`/api/orders/${data.orderID}/capture`, {
        method: "POST",
        headers: buildPayPalHeaders(initDataRef.current),
      });
      const captureData = await res.json();

      if (captureData.status === "COMPLETED" || captureData.status === "ORDER_ALREADY_COMPLETED") {
        const vid = captureData.payment_source?.paypal?.attributes?.vault?.id || "";
        const cid = captureData.payment_source?.paypal?.attributes?.vault?.customer?.id || "";
        if (cid || vid) saveVaultResult(isAuth, "paypal", cid, vid);
        showResult(
          `✓ Payment COMPLETED\nOrder: ${data.orderID}\nVault ID: ${vid}\nCustomer ID: ${cid}`,
          "success"
        );
      } else {
        showResult(`Error: ${JSON.stringify(captureData, null, 2)}`, "error");
      }
    },
    [showResult, isAuth, saveVaultResult]
  );

  useEffect(() => {
    if (!sdkReady || !window.paypal?.Buttons || !initData) return;

    const container = document.getElementById("paypal-button-container");
    if (container) container.innerHTML = "";

    const state = vaultRef.current?.getState();
    const vaultId = state?.vaultId || "";

    const btnOpts: Record<string, unknown> = {
      createOrder,
      onApprove,
      onError: (err: unknown) => showResult(`Error: ${err}`, "error"),
    };

    if (model === "returning" && vaultId) {
      btnOpts["createOrder"] = async () => {
        const orderAmount = vaultRef.current?.getState().orderAmount || "100";
        const body = {
          intent: "CAPTURE",
          purchase_units: [{ amount: { currency_code: "USD", value: orderAmount } }],
          payment_source: { paypal: { vault_id: vaultId } },
        };
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current!) },
          body: JSON.stringify(body),
        });
        const d = await res.json();
        return d.id;
      };
    }

    window.paypal.Buttons(btnOpts).render("#paypal-button-container");
  }, [sdkReady, initData, createOrder, onApprove, showResult, model]);

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <a href="/" className="text-slate-400 hover:text-slate-600 transition-colors text-sm">
            ← Dashboard
          </a>
          <span className="text-slate-200">/</span>
          <h1 className="text-xl font-black text-slate-900">PayPal Button Checkout</h1>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <VaultCommonPart
            ref={vaultRef}
            model={model}
            isUsePaypalAuthAssertion={isAuth}
            route="checkout-PayPal"
            showVaultOption={true}
            showOrderAmount={true}
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
        </div>

        {/* PayPal Button */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            PayPal Smart Payment Button
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

export default function CheckoutPayPalPage() {
  return (
    <Suspense>
      <CheckoutPayPalContent />
    </Suspense>
  );
}
