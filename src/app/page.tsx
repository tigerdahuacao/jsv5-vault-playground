"use client";

import { useState } from "react";
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

const leftBorderMap: Record<FlowColor, string> = {
  blue: "border-l-blue-500",
  emerald: "border-l-emerald-500",
  violet: "border-l-violet-500",
};

const categoryDotMap: Record<FlowColor, string> = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
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
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Vault Test Dashboard
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              PayPal Advanced Checkout &amp; Vault — card, PayPal, first-time and returning buyer flows.
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-500 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Sandbox
          </div>
        </div>

        {/* Config Panel */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Flow Configuration
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Buyer Type */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500">Buyer Type</label>
              <div className="flex gap-2">
                {(["firstTime", "returning"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setModel(m as VaultModel)}
                    className={cn(
                      "flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold border-2 transition-all duration-150",
                      model === m
                        ? "border-blue-500 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                    )}
                  >
                    {m === "firstTime" ? "First Time" : "Returning"}
                  </button>
                ))}
              </div>
            </div>

            {/* Auth Mode */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500">Auth Mode</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setUseAuthAssertion(true)}
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold border-2 transition-all duration-150",
                    useAuthAssertion
                      ? "border-violet-500 bg-violet-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50"
                  )}
                >
                  3rd Party
                </button>
                <button
                  onClick={() => setUseAuthAssertion(false)}
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold border-2 transition-all duration-150",
                    !useAuthAssertion
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50"
                  )}
                >
                  1st Party
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Client ID Panel */}
        <ClientIDPanel />

        {/* Flow Selection */}
        <div className="space-y-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Test Flows
          </p>
          <FlowSection
            title="With Purchase"
            color="blue"
            flows={withPurchase}
            onNavClick={onNavClick}
          />
          <FlowSection
            title="Without Purchase (Save Only)"
            color="emerald"
            flows={withoutPurchase}
            onNavClick={onNavClick}
            disabled={model === "returning"}
          />
          <FlowSection
            title="Raw API Demo"
            color="violet"
            flows={apiFlows}
            onNavClick={onNavClick}
          />
        </div>

        {/* Vault Info */}
        <VaultInfoPanel />

        {/* Test Card */}
        <CardCopyInfo
          cardNo={testCard.PAYPAL_TEST_CARD_NO}
          cardDate={testCard.PAYPAL_TEST_CARD_DATE}
          cardCvv={testCard.PAYPAL_TEST_CARD_CVV}
        />

        <footer className="text-center text-xs text-slate-300 pb-2">
          PayPal Vault Testing Tool · Sandbox Only
        </footer>
      </div>
    </main>
  );
}

function VaultInfoPanel() {
  const { thirdParty, firstParty } = useVaultStore();

  const rows: { label: string; party: typeof thirdParty; color: "violet" | "amber" }[] = [
    { label: "3rd Party", party: thirdParty, color: "violet" },
    { label: "1st Party", party: firstParty, color: "amber" },
  ];

  const hasAnyData = rows.some(
    (r) =>
      r.party.card.vaultID ||
      r.party.card.customerID ||
      r.party.paypal.vaultID ||
      r.party.paypal.customerID
  );

  if (!hasAnyData) return null;

  const badgeClass = {
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
        Stored Vault Info
      </p>
      <div className="space-y-4">
        {rows.map(({ label, party, color }) => {
          const hasCard = party.card.vaultID || party.card.customerID;
          const hasPaypal = party.paypal.vaultID || party.paypal.customerID;
          if (!hasCard && !hasPaypal) return null;
          return (
            <div key={label} className="space-y-2">
              <span className={cn("inline-flex text-xs font-semibold px-2 py-0.5 rounded border", badgeClass[color])}>
                {label}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {hasCard && <VaultInfoCard icon="💳" title="Card" data={party.card} />}
                {hasPaypal && <VaultInfoCard icon="🅿" title="PayPal" data={party.paypal} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VaultInfoCard({
  icon, title, data,
}: {
  icon: string;
  title: string;
  data: { customerID: string; vaultID: string };
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
      <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
        <span>{icon}</span>{title}
      </p>
      <InfoRow label="Customer ID" value={data.customerID} />
      <InfoRow label="Vault ID" value={data.vaultID} />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-mono text-slate-600 break-all flex-1">{value}</span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="text-[10px] text-slate-400 hover:text-blue-500 transition-colors shrink-0"
        >
          {copied ? "✓" : "copy"}
        </button>
      </div>
    </div>
  );
}

function FlowSection({
  title,
  color,
  flows,
  onNavClick,
  disabled = false,
}: {
  title: string;
  color: FlowColor;
  flows: Flow[];
  onNavClick: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("space-y-2", disabled && "opacity-40 pointer-events-none select-none")}>
      <div className="flex items-center gap-2">
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", categoryDotMap[color])} />
        <span className="text-xs font-semibold text-slate-500">{title}</span>
        {disabled && (
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
            Not available for returning buyers
          </span>
        )}
        <div className="flex-1 h-px bg-slate-200" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {flows.map((flow) => (
          <button
            key={flow.id}
            onClick={() => onNavClick(flow.id)}
            disabled={disabled}
            className={cn(
              "group bg-white rounded-xl border border-slate-200 border-l-4 p-4 text-left",
              "transition-all duration-150",
              !disabled && "hover:shadow-sm hover:border-slate-300",
              leftBorderMap[flow.color]
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl shrink-0">{flow.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{flow.label}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{flow.description}</p>
              </div>
              <svg
                className="w-4 h-4 text-slate-300 shrink-0 group-hover:text-slate-400 transition-colors"
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
