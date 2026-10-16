export interface ApiTraceEntry {
  id: string;
  label: string;
  timestamp: number;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: unknown;
  };
}
