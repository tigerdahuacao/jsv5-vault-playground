"use client";

import { useCallback, useState } from "react";
import type { ApiTraceEntry } from "@/types/trace";

export function useApiTraceLog() {
  const [entries, setEntries] = useState<ApiTraceEntry[]>([]);

  const pushTrace = useCallback((newEntries: ApiTraceEntry[]) => {
    if (newEntries.length === 0) return;
    setEntries((prev) => [...newEntries, ...prev]);
  }, []);

  return { entries, pushTrace };
}
