"use client";

import { useRouter } from "next/navigation";
import ClientIDPanel from "@/components/ClientIDPanel";
import CardCopyInfo from "@/components/CardCopyInfo";
import { testCard } from "@/lib/config";
import { useVaultStore, type VaultModel } from "@/store/vault";
import { cn } from "@/lib/utils";

type FlowColor = "blue" | "emerald" | "violet";
type FlowCategory = "with_purchase" | "without_purchase" | "api";

interface Flow {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: FlowCategory;
  color: FlowColor;
}

const flows: Flow[] = [
  {
    id: "checkout_ACDC",
    label: "ACDC Card",
    description: "Advanced Card Data Collection with vault support",
    icon: "💳",
    category: "with_purchase",
    color: "blue",
  },
  {
    id: "checkout_PayPal",
    label: "PayPal Button",
    description: "Smart Payment Button with PayPal vault",
    icon: "🅿",
    category: "with_purchase",
    color: "blue",
  },
  {
    id: "save_paypal",
    label: "Save PayPal",
    description: "Vault a PayPal account without making a purchase",
    icon: "🔒",
    category: "without_purchase",
    color: "emerald",
  },
  {
    id: "save_card",
    label: "Save Card",
    description: "Vault a card without making a purchase",
    icon: "🗃",
    category: "without_purchase",
    color: "emerald",
  },
  {
    id: "checkout_API",
    label: "API Vault",
    description: "Step-by-step raw API vault demo",
    icon: "⚡",
    category: "api",
    color: "violet",
  },
] as const;

const colorMap = {
  blue: "hover:border-blue-400 hover:shadow-blue-100",
  emerald: "hover:border-emerald-400 hover:shadow-emerald-100",
  violet: "hover:border-violet-400 hover:shadow-violet-100",
};

export default function HomePage() {
  const router = useRouter();
  const {
    model, setModel,
    useAuthAssertion, setUseAuthAssertion,
    thirdPartyApp, firstPartyApp,
  } = useVaultStore();

  const onNavClick = (route: string) => {
    if (useAuthAssertion && !thirdPartyApp) {
      alert("Please choose a 3rd Party Client!");
      return;
    }
    if (!useAuthAssertion && !firstPartyApp) {
      alert("Please choose a 1st Party Client!");
      return;
    }
    router.push(`/${route}?model=${model}&is_use_PAYPAL_AUTH_ASSERTION=${useAuthAssertion}`);
  };

  const withPurchase = flows.filter((f) => f.category === "with_purchase");
  const withoutPurchase = flows.filter((f) => f.category === "without_purchase");
  const apiFlows = flows.filter((f) => f.category === "api");

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            PayPal Sandbox
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Vault Test Dashboard
          </h1>
          <p className="text-slate-500 text-sm max-w-xl mx-auto leading-relaxed">
            Test PayPal Advanced Checkout &amp; Vault integration — card vaulting, PayPal vaulting,
            first-time and returning buyer flows.
          </p>
        </div>

        {/* Config Panel */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 space-y-5">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Flow Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Buyer Type */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Buyer Type
              </label>
              <div className="flex gap-2">
                {(["firstTime", "returning"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setModel(m as VaultModel)}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-xl text-sm font-semibold border-2 transition-all duration-200",
                      model === m
                        ? "border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-200 scale-[1.02]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                    )}
                  >
                    {m === "firstTime" ? "🆕 First Time" : "🔁 Returning"}
                  </button>
                ))}
              </div>
            </div>

            {/* Auth Mode — mutually exclusive buttons */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Auth Mode
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setUseAuthAssertion(true)}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl text-sm font-semibold border-2 transition-all duration-200",
                    useAuthAssertion
                      ? "border-violet-500 bg-violet-600 text-white shadow-lg shadow-violet-200 scale-[1.02]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50"
                  )}
                >
                  3rd Party
                </button>
                <button
                  onClick={() => setUseAuthAssertion(false)}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl text-sm font-semibold border-2 transition-all duration-200",
                    !useAuthAssertion
                      ? "border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-200 scale-[1.02]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50"
                  )}
                >
                  1st Party
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Client ID Panel — shows only the relevant party */}
        <ClientIDPanel />

        {/* Flow Selection */}
        <div className="space-y-5">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Test Flows
          </h2>
          <FlowSection title="With Purchase" flows={withPurchase} onNavClick={onNavClick} />
          <FlowSection title="Without Purchase (Save Only)" flows={withoutPurchase} onNavClick={onNavClick} />
          <FlowSection title="Raw API Demo" flows={apiFlows} onNavClick={onNavClick} />
        </div>

        {/* Test Card */}
        <CardCopyInfo
          cardNo={testCard.PAYPAL_TEST_CARD_NO}
          cardDate={testCard.PAYPAL_TEST_CARD_DATE}
          cardCvv={testCard.PAYPAL_TEST_CARD_CVV}
        />

        <footer className="text-center text-xs text-slate-300 pb-4">
          PayPal Vault Testing Tool · Sandbox Only
        </footer>
      </div>
    </main>
  );
}

function FlowSection({
  title,
  flows,
  onNavClick,
}: {
  title: string;
  flows: Flow[];
  onNavClick: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
          {title}
        </span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {flows.map((flow) => (
          <button
            key={flow.id}
            onClick={() => onNavClick(flow.id)}
            className={cn(
              "group bg-white rounded-xl border-2 border-slate-200 p-4 text-left",
              "transition-all duration-200 hover:shadow-lg hover:scale-[1.01]",
              colorMap[flow.color]
            )}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">{flow.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800">{flow.label}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{flow.description}</p>
              </div>
              <svg
                className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
