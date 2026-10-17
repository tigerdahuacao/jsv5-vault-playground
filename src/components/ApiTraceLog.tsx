"use client";

/**
 * ApiTraceLog — PayPal API 调用的请求/响应 trace 展示面板
 *
 * 展示 paypal-api.ts 每次真实调用 PayPal 的方法/URL/headers/body
 * 和响应 status/headers/body。纯前端内存状态，刷新页面即清空。
 *
 * 使用位置：
 * - src/app/checkout-ACDC/page.tsx
 * - src/app/checkout-PayPal/page.tsx
 * - src/app/checkout-API/page.tsx
 * - src/app/save-card/page.tsx
 * - src/app/save-PayPal/page.tsx
 */

import { useState } from "react";
import type { ApiTraceEntry } from "@/types/trace";
import { cn } from "@/lib/utils";

interface ApiTraceLogProps {
  entries: ApiTraceEntry[];
  className?: string;
}

function JsonBlock({ title, data }: { title: string; data: unknown }) {
  const [copied, setCopied] = useState(false);
  const text =
    data === undefined
      ? "(none)"
      : typeof data === "string"
        ? data
        : JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          {title}
        </span>
        <button
          onClick={handleCopy}
          className="text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <pre className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/40 overflow-x-auto text-[11px] leading-relaxed text-slate-300">
        {text}
      </pre>
    </div>
  );
}

function TraceRow({ entry }: { entry: ApiTraceEntry }) {
  const [expanded, setExpanded] = useState(false);
  const ok = entry.response.status >= 200 && entry.response.status < 300;
  const path = (() => {
    try {
      return new URL(entry.request.url).pathname;
    } catch {
      return entry.request.url;
    }
  })();

  return (
    <div className="border-b border-slate-700/40 last:border-b-0">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-800/40 transition-colors"
      >
        <span className={cn("w-2 h-2 rounded-full shrink-0", ok ? "bg-emerald-500" : "bg-rose-500")} />
        <span className="text-xs font-mono text-slate-300 shrink-0">{entry.request.method}</span>
        <span className="text-xs font-mono text-slate-500 truncate flex-1">{path}</span>
        <span className={cn("text-[10px] font-bold shrink-0", ok ? "text-emerald-400" : "text-rose-400")}>
          {entry.response.status}
        </span>
        <span className="text-[10px] text-slate-600 font-mono shrink-0">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
        <span className="text-slate-600 text-xs shrink-0">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs font-semibold text-slate-400">{entry.label}</p>
          <JsonBlock title="Request Headers" data={entry.request.headers} />
          <JsonBlock title="Request Body" data={entry.request.body} />
          <JsonBlock title="Response Headers" data={entry.response.headers} />
          <JsonBlock title="Response Body" data={entry.response.body} />
        </div>
      )}
    </div>
  );
}

export default function ApiTraceLog({ entries, className }: ApiTraceLogProps) {
  if (entries.length === 0) return null;

  return (
    <div className={cn("rounded-xl overflow-hidden border border-slate-700/60 bg-[#0f1117]", className)}>
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/60">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          API Trace ({entries.length})
        </span>
      </div>
      <div className="max-h-[32rem] overflow-y-auto">
        {entries.map((entry) => (
          <TraceRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
