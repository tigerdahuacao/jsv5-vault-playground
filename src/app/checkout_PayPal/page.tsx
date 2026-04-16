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


function CheckoutPayPalContent() {
  const searchParams = useSearchParams();
  const model = searchParams.get("model") || "firstTime";
  const isAuth = searchParams.get("is_use_PAYPAL_AUTH_ASSERTION") === "true";

  const saveVaultResult = useVaultStore((s) => s.saveVaultResult);
  const vaultRef = useRef<VaultCommonPartRef>(null);
  const [initData, setInitData] = useState<VaultInitData | null>(null);
  const [resultMsg, setResultMsg] = useState("Waiting for payment...");
  const [resultType, setResultType] = useState<ResultType>("idle");

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

    await fetch("/api/vault/store-params", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVaultSave: true, isCard: false }),
    });

    const payment_source: Record<string, unknown> = {
      paypal: {
        attributes: {
          vault: useVault
            ? undefined
            : { store_in_vault: "ON_SUCCESS", usage_type: "MERCHANT" },
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.id;
  }, []);

  const onApprove = useCallback(
    async (data: { orderID: string }) => {
      showResult("Processing payment...", "info");
      const res = await fetch(`/api/orders/${data.orderID}/capture`, {
        method: "POST",
      });
      const captureData = await res.json();

      if (captureData.status === "COMPLETED" || captureData.status === "ORDER_ALREADY_COMPLETED") {
        const vid = captureData.payment_source?.paypal?.attributes?.vault?.id || "";
        const cid = captureData.payment_source?.paypal?.attributes?.vault?.customer?.id || "";
        if (cid || vid) saveVaultResult(isAuth, cid, vid);
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = await res.json();
        return d.id;
      };
    }

    window.paypal.Buttons(btnOpts).render("#paypal-button-container");
  }, [sdkReady, initData, createOrder, onApprove, showResult, model]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <a href="/" className="text-slate-400 hover:text-slate-600 transition-colors text-sm">
            ← Dashboard
          </a>
          <span className="text-slate-200">/</span>
          <h1 className="text-xl font-black text-slate-900">PayPal Button Checkout</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
          <VaultCommonPart
            ref={vaultRef}
            model={model}
            isUsePaypalAuthAssertion={isAuth}
            route="checkout_PayPal"
            showVaultOption={true}
            showOrderAmount={true}
            onInitDataLoaded={handleInitLoaded}
          />
        </div>

        {/* PayPal Button */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 space-y-4">
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

export default function CheckoutPayPalPage() {
  return (
    <Suspense>
      <CheckoutPayPalContent />
    </Suspense>
  );
}
