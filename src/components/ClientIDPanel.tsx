"use client";

import { useState } from "react";
import { clientIDConfigs, type AppEntry } from "@/lib/config";
import { useVaultStore } from "@/store/vault";
import { cn } from "@/lib/utils";

interface ClientIDPanelProps {
  className?: string;
}

function AppSelect({
  type,
  options,
}: {
  type: "3rdParty" | "1stParty";
  options: Record<string, AppEntry>;
}) {
  const { thirdPartyApp, firstPartyApp, setThirdPartyApp, setFirstPartyApp } =
    useVaultStore();

  const selected = type === "3rdParty" ? thirdPartyApp : firstPartyApp;
  const [expanded, setExpanded] = useState(false);

  const handleChange = (tagName: string) => {
    if (type === "3rdParty") {
      const entry = tagName ? options[tagName] : null;
      setThirdPartyApp(tagName, entry?.merchantID || "");
    } else {
      setFirstPartyApp(tagName);
    }
  };

  const selectedEntry = selected ? options[selected] : null;
  const label =
    type === "3rdParty" ? "3rd Party (Partner)" : "1st Party (Direct Merchant)";
  const badgeClass =
    type === "3rdParty"
      ? "bg-violet-100 text-violet-700 border border-violet-200"
      : "bg-amber-100 text-amber-700 border border-amber-200";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", badgeClass)}>
          {label}
        </span>
      </div>

      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        data-select={type}
        className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 font-medium
          focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all cursor-pointer
          hover:border-slate-300"
      >
        <option value="">— Select App —</option>
        {Object.keys(options).map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </select>

      {selectedEntry && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
          <button
            onClick={() => setExpanded((p) => !p)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <span>App Details</span>
            <span className="text-slate-400">{expanded ? "▲" : "▼"}</span>
          </button>
          {expanded && (
            <div className="px-4 pb-3 space-y-2">
              <DetailRow label="Client ID" value={selectedEntry.clientID} />
              <DetailRow label="Secret" value={selectedEntry.secret} masked />
              {selectedEntry.merchantID && (
                <DetailRow label="Merchant ID" value={selectedEntry.merchantID} />
              )}
              {selectedEntry["partner-id"] && (
                <DetailRow label="Partner ID" value={selectedEntry["partner-id"]!} />
              )}
              {selectedEntry["partner-email"] && (
                <DetailRow label="Partner Email" value={selectedEntry["partner-email"]!} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  masked,
}: {
  label: string;
  value: string;
  masked?: boolean;
}) {
  const [show, setShow] = useState(!masked);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-slate-600 break-all flex-1">
          {masked && !show ? "••••••••••••" : value}
        </span>
        {masked && (
          <button
            onClick={() => setShow((p) => !p)}
            className="text-xs text-blue-500 hover:text-blue-700 shrink-0"
          >
            {show ? "Hide" : "Show"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ClientIDPanel({ className }: ClientIDPanelProps) {
  return (
    <div className={cn("bg-white rounded-2xl shadow-lg border border-slate-100 p-5", className)}>
      <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-blue-500" />
        Client Configuration
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AppSelect type="3rdParty" options={clientIDConfigs.thirdParty} />
        <AppSelect type="1stParty" options={clientIDConfigs.firstParty} />
      </div>
    </div>
  );
}
