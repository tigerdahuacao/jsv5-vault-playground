import type { ApiTraceEntry } from "@/types/trace";

type WithTrace = { __trace?: ApiTraceEntry | ApiTraceEntry[] };

/**
 * Pulls the server-embedded `__trace` field out of a parsed API response,
 * normalizing it to an array and returning the rest of the payload untouched
 * so existing call sites can keep reading their named fields (`data.id`, etc.).
 */
export function extractTrace<T extends WithTrace>(
  data: T
): { data: Omit<T, "__trace">; trace: ApiTraceEntry[] } {
  const { __trace, ...rest } = data;
  const trace = !__trace ? [] : Array.isArray(__trace) ? __trace : [__trace];
  return { data: rest, trace };
}
