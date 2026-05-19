"use client";

import { useState } from "react";
import { clientIDConfigs, type AppEntry } from "@/lib/config";
import { useVaultStore } from "@/store/vault";
import { cn } from "@/lib/utils";

interface ClientIDPanelProps {
  className?: string;
}

function AppDetails({ entry }: { entry: AppEntry }) {
  const [showSecret, setShowSecret] = useState(false);
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">App Details</p>
      <DetailRow label="Client ID" value={entry.clientID} />
      <DetailRow label="Secret" value={entry.secret} masked showState={showSecret} onToggle={() => setShowSecret(p => !p)} />
      {entry.merchantID && <DetailRow label="Merchant ID" value={entry.merchantID} />}
      {entry["partner-id"] && <DetailRow label="Partner ID" value={entry["partner-id"]!} />}
      {entry["partner-email"] && <DetailRow label="Partner Email" value={entry["partner-email"]!} />}
    </div>
  );
}

function DetailRow({
  label,
  value,
  masked,
  showState,
  onToggle,
}: {
  label: string;
  value: string;
  masked?: boolean;
  showState?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-slate-600 break-all flex-1">
          {masked && !showState ? "••••••••••••" : value}
        </span>
        {masked && (
          <button
            onClick={onToggle}
            className="text-xs text-blue-500 hover:text-blue-700 shrink-0"
          >
            {showState ? "Hide" : "Show"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ClientIDPanel({ className }: ClientIDPanelProps) {
  const {
    thirdPartyApp, firstPartyApp,
    thirdParty,
    useAuthAssertion,
    setThirdPartyApp, setFirstPartyApp, setThirdPartyMerchantID,
  } = useVaultStore();

  const is3rd = useAuthAssertion;
  const options = is3rd ? clientIDConfigs.thirdParty : clientIDConfigs.firstParty;
  const selected = is3rd ? thirdPartyApp : firstPartyApp;
  const selectedEntry = selected ? options[selected] : null;

  const handleChange = (tagName: string) => {
    if (is3rd) {
      const entry = tagName ? options[tagName] : null;
      setThirdPartyApp(tagName, (entry as AppEntry & { merchantID?: string })?.merchantID || "");
    } else {
      setFirstPartyApp(tagName);
    }
  };

  const badgeClass = is3rd
    ? "bg-violet-100 text-violet-700 border border-violet-200"
    : "bg-amber-100 text-amber-700 border border-amber-200";
  const label = is3rd ? "3rd Party (Partner)" : "1st Party (Direct Merchant)";
  const focusClass = is3rd
    ? "focus:border-violet-500 focus:ring-violet-100"
    : "focus:border-amber-500 focus:ring-amber-100";

  return (
    <div className={cn("bg-white rounded-2xl shadow-lg border border-slate-100 p-5", className)}>
      <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-blue-500" />
        Client Configuration
      </h3>

      <div className="flex items-center gap-2 mb-3">
        <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", badgeClass)}>
          {label}
        </span>
      </div>

      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        data-select={is3rd ? "3rdParty" : "1stParty"}
        className={cn(
          "w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 font-medium",
          "focus:ring-2 focus:outline-none transition-all cursor-pointer hover:border-slate-300",
          focusClass
        )}
      >
        <option value="">— Select App —</option>
        {Object.keys(options).map((key) => (
          <option key={key} value={key}>{key}</option>
        ))}
      </select>

      {selectedEntry && <AppDetails entry={selectedEntry} />}

      {/* 3rd party requires a sub-merchant ID for PayPal-Auth-Assertion */}
      {is3rd && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            Auth-Assertion Target
          </p>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-400 font-medium">
              Sub-Merchant ID <span className="text-rose-400">(required)</span>
            </span>
            <input
              type="text"
              value={thirdParty.merchantID}
              onChange={(e) => setThirdPartyMerchantID(e.target.value)}
              placeholder="e.g. CMHAMMNAXCMGA"
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-600
                focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100 transition-all"
            />
            {!thirdParty.merchantID && (
              <p className="text-xs text-rose-400 mt-0.5">
                Missing — PayPal-Auth-Assertion will return 401.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
