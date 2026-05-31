"use client";

/**
 * ResultArea — 终端风格的日志输出组件
 *
 * 用于展示 PayPal API 调用的结果（成功 / 错误 / 处理中 / 等待）。
 * 消息内容中的 JSON 块会被自动识别并格式化展示，支持一键复制全文。
 * 高度固定可滚动（max-h-96），避免长错误内容撑开页面。
 *
 * Props：
 * - message: 要显示的文本，可包含嵌入的 JSON 字符串
 * - type: "success" | "error" | "info" | "idle"，控制颜色和标签
 *
 * 使用位置：
 * - src/app/checkout-ACDC/page.tsx
 * - src/app/checkout-PayPal/page.tsx
 * - src/app/checkout-API/page.tsx
 * - src/app/save-card/page.tsx
 * - src/app/save-PayPal/page.tsx
 */

import { useState } from "react";
import { cn } from "@/lib/utils";

export type ResultType = "success" | "error" | "info" | "idle";

interface ResultAreaProps {
  message: string;
  type: ResultType;
  className?: string;
}

const accentColor: Record<ResultType, string> = {
  success: "bg-emerald-500",
  error:   "bg-rose-500",
  info:    "bg-sky-400",
  idle:    "bg-slate-300",
};

const labelColor: Record<ResultType, string> = {
  success: "text-emerald-400",
  error:   "text-rose-400",
  info:    "text-sky-400",
  idle:    "text-slate-500",
};

const label: Record<ResultType, string> = {
  success: "SUCCESS",
  error:   "ERROR",
  info:    "INFO",
  idle:    "WAITING",
};

const textColor: Record<ResultType, string> = {
  success: "text-emerald-300",
  error:   "text-rose-300",
  info:    "text-sky-300",
  idle:    "text-slate-400",
};

// Split a message string into plain-text and JSON block segments
function parseSegments(message: string): Array<{ kind: "text" | "json"; content: string }> {
  const segments: Array<{ kind: "text" | "json"; content: string }> = [];
  // Greedy match of top-level JSON objects/arrays
  const jsonRegex = /(\{[\s\S]*\}|\[[\s\S]*\])/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = jsonRegex.exec(message)) !== null) {
    try {
      const parsed = JSON.parse(match[0]);
      if (last < match.index) {
        segments.push({ kind: "text", content: message.slice(last, match.index) });
      }
      segments.push({ kind: "json", content: JSON.stringify(parsed, null, 2) });
      last = match.index + match[0].length;
    } catch {
      // not valid JSON — skip
    }
  }

  if (last < message.length) {
    segments.push({ kind: "text", content: message.slice(last) });
  }

  return segments.length > 0 ? segments : [{ kind: "text", content: message }];
}

export default function ResultArea({ message, type, className }: ResultAreaProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const segments = parseSegments(message || "Waiting for result...");

  return (
    <div className={cn("rounded-xl overflow-hidden border border-slate-700/60 bg-[#0f1117]", className)}>
      {/* Terminal title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/60">
        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0 transition-colors duration-300", accentColor[type])} />
        <span className={cn("text-[10px] font-bold uppercase tracking-widest transition-colors duration-300", labelColor[type])}>
          {label[type]}
        </span>
        <div className="flex-1" />
        {type !== "idle" && (
          <button
            onClick={handleCopy}
            className="text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors px-1.5 py-0.5 rounded"
          >
            {copied ? "✓ copied" : "copy"}
          </button>
        )}
        <span className="text-[10px] text-slate-600 font-mono">log</span>
      </div>

      {/* Log body — scrollable with max height */}
      <div className="px-4 py-3.5 min-h-[72px] max-h-96 overflow-y-auto flex items-start gap-2">
        <span className="text-slate-600 font-mono text-xs select-none shrink-0 mt-px">$</span>
        <div className={cn("text-xs leading-relaxed flex-1 min-w-0 font-mono transition-colors duration-300", textColor[type])}>
          {segments.map((seg, i) =>
            seg.kind === "json" ? (
              <pre
                key={i}
                className="mt-1 p-2 rounded-lg bg-slate-800/60 border border-slate-700/40 overflow-x-auto text-[11px] leading-relaxed"
              >
                {seg.content}
              </pre>
            ) : (
              <span key={i} className="whitespace-pre-wrap break-words">
                {seg.content}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}
