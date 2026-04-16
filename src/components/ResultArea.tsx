"use client";

import { cn } from "@/lib/utils";

export type ResultType = "success" | "error" | "info" | "idle";

interface ResultAreaProps {
  message: string;
  type: ResultType;
  className?: string;
}

const typeStyles: Record<ResultType, string> = {
  success:
    "bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800",
  error: "bg-rose-50 border-l-4 border-rose-500 text-rose-800",
  info: "bg-sky-50 border-l-4 border-sky-500 text-sky-800",
  idle: "bg-slate-50 border-l-4 border-slate-300 text-slate-500",
};

const typeIcons: Record<ResultType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  idle: "—",
};

export default function ResultArea({
  message,
  type,
  className,
}: ResultAreaProps) {
  return (
    <div
      className={cn(
        "rounded-xl p-4 transition-all duration-300 min-h-[60px]",
        typeStyles[type],
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="font-bold text-lg leading-tight mt-0.5">
          {typeIcons[type]}
        </span>
        <div
          className="text-sm leading-relaxed flex-1 break-words whitespace-pre-wrap font-mono"
          dangerouslySetInnerHTML={{ __html: message || "Waiting for result..." }}
        />
      </div>
    </div>
  );
}
