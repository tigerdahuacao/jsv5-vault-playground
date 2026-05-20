"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import VaultCommonPart, {
  type VaultCommonPartRef,
  type VaultInitData,
} from "@/components/VaultCommonPart";
import ResultArea, { type ResultType } from "@/components/ResultArea";
import { USE_API_VAULT } from "@/lib/config";
import { cn } from "@/lib/utils";
import { buildPayPalHeaders } from "@/lib/api-client";

type SourceType = "card" | "paypal";

interface StepState {
  requestBody: string;
  response: string;
  loading: boolean;
  done: boolean;
}

const initialStep = (): StepState => ({
  requestBody: "",
  response: "",
  loading: false,
  done: false,
});

function CheckoutAPIContent() {
  const searchParams = useSearchParams();
  const model = searchParams.get("model") || "firstTime";
  const isAuth = searchParams.get("is_use_PAYPAL_AUTH_ASSERTION") === "true";

  const vaultRef = useRef<VaultCommonPartRef>(null);
  const [initData, setInitData] = useState<VaultInitData | null>(null);
  const initDataRef = useRef<VaultInitData | null>(null);
  const [sourceType, setSourceType] = useState<SourceType>("card");

  const [step1, setStep1] = useState<StepState>({
    ...initialStep(),
    requestBody: USE_API_VAULT.card.Setup_token_for_card,
  });
  const [step2, setStep2] = useState<StepState>({
    ...initialStep(),
    requestBody: USE_API_VAULT.card.Create_payment_token_for_card,
  });
  const [step3, setStep3] = useState<StepState>({
    ...initialStep(),
    requestBody: USE_API_VAULT.card.Make_payment_for_card,
  });
  const [step4, setStep4] = useState<StepState>({
    ...initialStep(),
    requestBody: "customer_id=YOUR_CUSTOMER_ID",
  });

  const [globalResult, setGlobalResult] = useState("Run the steps below to test the API vault flow.");
  const [globalResultType, setGlobalResultType] = useState<ResultType>("idle");

  const handleInitLoaded = useCallback((data: VaultInitData) => {
    setInitData(data);
    initDataRef.current = data;
    // Pre-initialize vault API access (no SDK needed for API flow)
    fetch(
      `/api/vault/init?model=${data.VAULT_MODEL}&is_use_PAYPAL_AUTH_ASSERTION=${data.is_use_PAYPAL_AUTH_ASSERTION}`
    ).catch(() => {});
  }, []);

  // Step 1 — Create setup token for card
  const runStep1 = async () => {
    setStep1((s) => ({ ...s, loading: true, response: "" }));
    try {
      const body = JSON.parse(step1.requestBody);
      if (!initDataRef.current) return;
      const res = await fetch("/api/vault/paypal-api", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
        body: JSON.stringify({ endpoint: "/v3/vault/setup-tokens", requestBody: body }),
      });
      const data = await res.json();
      const pretty = JSON.stringify(data, null, 2);
      setStep1((s) => ({ ...s, loading: false, done: true, response: pretty }));

      // Auto-fill step 2 with returned setup token id
      if (data.id) {
        const nextBody = JSON.parse(step2.requestBody);
        nextBody.payment_source.token.id = data.id;
        setStep2((s) => ({
          ...s,
          requestBody: JSON.stringify(nextBody, null, 2),
        }));
      }
    } catch (e) {
      setStep1((s) => ({ ...s, loading: false, response: `Error: ${e}` }));
    }
  };

  // Step 2 — Create payment token
  const runStep2 = async () => {
    setStep2((s) => ({ ...s, loading: true, response: "" }));
    try {
      const body = JSON.parse(step2.requestBody);
      if (!initDataRef.current) return;
      const res = await fetch("/api/vault/paypal-api", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildPayPalHeaders(initDataRef.current) },
        body: JSON.stringify({ endpoint: "/v3/vault/payment-tokens", requestBody: body }),
      });
      const data = await res.json();
      const pretty = JSON.stringify(data, null, 2);
      setStep2((s) => ({ ...s, loading: false, done: true, response: pretty }));

      // Auto-fill step 3 vault_id and step 4 customer_id
      if (data.id) {
        const s3 = JSON.parse(step3.requestBody);
        s3.payment_source.card.vault_id = data.id;
        setStep3((s) => ({ ...s, requestBody: JSON.stringify(s3, null, 2) }));
      }
      if (data.customer?.id) {
        setStep4((s) => ({ ...s, requestBody: `customer_id=${data.customer.id}` }));
      }
    } catch (e) {
      setStep2((s) => ({ ...s, loading: false, response: `Error: ${e}` }));
    }
  };

  // Step 3 — Make payment with vaulted card
  const runStep3 = async () => {
    setStep3((s) => ({ ...s, loading: true, response: "" }));
    try {
      const body = JSON.parse(step3.requestBody);

      // Create order
      if (!initDataRef.current) return;
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
      setStep3((s) => ({ ...s, loading: false, done: true, response: pretty }));
      setGlobalResult(`✓ Payment completed! Order: ${orderData.id}`);
      setGlobalResultType("success");
    } catch (e) {
      setStep3((s) => ({ ...s, loading: false, response: `Error: ${e}` }));
    }
  };

  // Step 4 — Retrieve stored tokens by customer ID
  const runStep4 = async () => {
    setStep4((s) => ({ ...s, loading: true, response: "" }));
    try {
      const params = new URLSearchParams(step4.requestBody);
      const customerId = params.get("customer_id") || "";
      if (!initDataRef.current) return;
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
    } catch (e) {
      setStep4((s) => ({ ...s, loading: false, response: `Error: ${e}` }));
    }
  };

  const switchSourceType = (type: SourceType) => {
    setSourceType(type);
    setStep1((s) => ({
      ...s,
      requestBody:
        type === "paypal"
          ? USE_API_VAULT.paypal.Setup_token_for_paypal
          : USE_API_VAULT.card.Setup_token_for_card,
      response: "",
      done: false,
    }));
  };

  const steps = [
    {
      num: 1,
      title: sourceType === "card" ? "Create Setup Token (Card)" : "Create Setup Token (PayPal)",
      description:
        sourceType === "card"
          ? "Initialize vault by creating a setup token for a card"
          : "Initialize vault by creating a setup token for a PayPal account",
      state: step1,
      setState: setStep1,
      onRun: runStep1,
      color: "blue" as const,
    },
    {
      num: 2,
      title: "Create Payment Token",
      description: "Convert setup token into a reusable payment token (vault ID)",
      state: step2,
      setState: setStep2,
      onRun: runStep2,
      color: "violet" as const,
    },
    {
      num: 3,
      title: "Pay with Vaulted Card",
      description: "Create and capture an order using the vault ID",
      state: step3,
      setState: setStep3,
      onRun: runStep3,
      color: "emerald" as const,
    },
    {
      num: 4,
      title: "Retrieve Stored Tokens",
      description: "Fetch all payment tokens for a customer ID",
      state: step4,
      setState: setStep4,
      onRun: runStep4,
      color: "amber" as const,
    },
  ] as const;

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <a href="/" className="text-slate-400 hover:text-slate-600 transition-colors text-sm">
            ← Dashboard
          </a>
          <span className="text-slate-200">/</span>
          <h1 className="text-xl font-black text-slate-900">API Vault Demo</h1>
          <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            Raw API · No SDK
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <VaultCommonPart
            ref={vaultRef}
            model={model}
            isUsePaypalAuthAssertion={isAuth}
            route="checkout_API"
            showVaultOption={false}
            showOrderAmount={false}
            onInitDataLoaded={handleInitLoaded}
          />
        </div>

        {/* Source type toggle */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Step 1 Source
          </span>
          <div className="flex gap-1.5">
            {(["card", "paypal"] as const).map((t) => (
              <button
                key={t}
                onClick={() => switchSourceType(t)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                  sourceType === t
                    ? "bg-blue-600 border-blue-600 text-white shadow"
                    : "bg-white border-slate-200 text-slate-500 hover:border-blue-300"
                )}
              >
                {t === "card" ? "💳 Card" : "🅿 PayPal"}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-400 px-1">
          Each step auto-fills values from the previous response. Run them in order for a complete vault flow.
        </p>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step) => (
            <ApiStep key={step.num} {...step} />
          ))}
        </div>

        <ResultArea message={globalResult} type={globalResultType} />
      </div>
    </main>
  );
}

const stepColors = {
  blue: {
    badge: "bg-blue-600 text-white",
    border: "border-blue-200",
    ring: "ring-blue-100",
    btn: "bg-blue-600 hover:bg-blue-700 shadow-blue-200",
    done: "bg-blue-50",
  },
  violet: {
    badge: "bg-violet-600 text-white",
    border: "border-violet-200",
    ring: "ring-violet-100",
    btn: "bg-violet-600 hover:bg-violet-700 shadow-violet-200",
    done: "bg-violet-50",
  },
  emerald: {
    badge: "bg-emerald-600 text-white",
    border: "border-emerald-200",
    ring: "ring-emerald-100",
    btn: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200",
    done: "bg-emerald-50",
  },
  amber: {
    badge: "bg-amber-500 text-white",
    border: "border-amber-200",
    ring: "ring-amber-100",
    btn: "bg-amber-500 hover:bg-amber-600 shadow-amber-200",
    done: "bg-amber-50",
  },
} as const;

function ApiStep({
  num,
  title,
  description,
  state,
  setState,
  onRun,
  color,
}: {
  num: number;
  title: string;
  description: string;
  state: StepState;
  setState: React.Dispatch<React.SetStateAction<StepState>>;
  onRun: () => Promise<void>;
  color: keyof typeof stepColors;
}) {
  const c = stepColors[color];

  return (
    <div
      className={cn(
        "bg-white rounded-xl border-2 transition-all duration-200",
        state.done ? `${c.done} ${c.border}` : "border-slate-200"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-5 pb-4">
        <span
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0",
            state.done ? c.badge : "bg-slate-100 text-slate-500"
          )}
        >
          {state.done ? "✓" : num}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        </div>
        <button
          onClick={onRun}
          disabled={state.loading}
          className={cn(
            "px-4 py-2 rounded-lg text-white text-xs font-bold transition-all duration-150",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            c.btn
          )}
        >
          {state.loading ? (
            <span className="flex items-center gap-1.5">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Running...
            </span>
          ) : (
            "Run ▶"
          )}
        </button>
      </div>

      {/* Body */}
      <div className="px-5 pb-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Request Body
            </label>
            <textarea
              value={state.requestBody}
              onChange={(e) =>
                setState((s) => ({ ...s, requestBody: e.target.value }))
              }
              rows={8}
              className={cn(
                "w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-mono text-slate-700 resize-none",
                "focus:outline-none focus:border-slate-400 focus:ring-2",
                c.ring,
                "transition-all"
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Response
            </label>
            <textarea
              value={state.response}
              readOnly
              rows={8}
              placeholder="Response will appear here..."
              className={cn(
                "w-full rounded-xl border-2 border-slate-100 bg-white px-3 py-2.5 text-xs font-mono text-slate-600 resize-none",
                state.done && !state.response.startsWith("Error")
                  ? "border-emerald-200 bg-emerald-50"
                  : state.response.startsWith("Error")
                  ? "border-rose-200 bg-rose-50"
                  : ""
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutAPIPage() {
  return (
    <Suspense>
      <CheckoutAPIContent />
    </Suspense>
  );
}
