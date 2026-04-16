"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface CardCopyInfoProps {
  cardNo: string;
  cardDate: string;
  cardCvv: string;
}

function CopyButton({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
        {label}
      </span>
      <button
        onClick={handleCopy}
        className={cn(
          "group flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-mono transition-all duration-200",
          copied
            ? "border-emerald-400 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
        )}
      >
        <span>{value}</span>
        <span className="ml-auto text-xs opacity-60 group-hover:opacity-100">
          {copied ? "✓ Copied" : "Copy"}
        </span>
      </button>
    </div>
  );
}

export default function CardCopyInfo({
  cardNo,
  cardDate,
  cardCvv,
}: CardCopyInfoProps) {
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 shadow-xl shadow-slate-900/20">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-5 rounded bg-amber-400 shadow-sm" />
        <span className="text-white font-semibold text-sm tracking-wide">
          Test Card
        </span>
        <span className="ml-auto text-xs text-slate-400 font-mono">
          SANDBOX ONLY
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <CopyButton value={cardNo} label="Card Number" />
        </div>
        <div>
          <CopyButton value={cardDate} label="Expiry" />
        </div>
        <div>
          <CopyButton value={cardCvv} label="CVV" />
        </div>
      </div>
    </div>
  );
}
