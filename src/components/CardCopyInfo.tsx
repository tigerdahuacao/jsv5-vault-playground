"use client";

/**
 * CardCopyInfo — 沙箱测试卡片信息展示组件
 *
 * 以深色卡片样式展示 PayPal 沙箱测试卡的卡号、有效期、CVV，
 * 每个字段都带一键复制按钮，方便在填写 Card Fields 时快速粘贴。
 *
 * 使用位置：
 * - src/app/page.tsx（首页，全局常驻展示）
 * - src/app/checkout-ACDC/page.tsx（ACDC 结账页，SDK 加载后才显示）
 * - src/app/save-card/page.tsx（保存卡页）
 */

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
