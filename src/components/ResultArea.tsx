"use client";

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

export default function ResultArea({ message, type, className }: ResultAreaProps) {
  return (
    <div className={cn("rounded-2xl overflow-hidden border border-slate-700/60 bg-[#0f1117]", className)}>
      {/* Terminal title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/60">
        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0 transition-colors duration-300", accentColor[type])} />
        <span className={cn("text-[10px] font-bold uppercase tracking-widest transition-colors duration-300", labelColor[type])}>
          {label[type]}
        </span>
        <div className="flex-1" />
        <span className="text-[10px] text-slate-600 font-mono">log</span>
      </div>

      {/* Log body */}
      <div className="px-4 py-3.5 min-h-[72px] flex items-start gap-2">
        <span className="text-slate-600 font-mono text-xs select-none shrink-0 mt-px">$</span>
        <div
          className={cn(
            "text-xs leading-relaxed flex-1 break-words whitespace-pre-wrap font-mono transition-colors duration-300",
            textColor[type]
          )}
          dangerouslySetInnerHTML={{ __html: message || "Waiting for result..." }}
        />
      </div>
    </div>
  );
}
