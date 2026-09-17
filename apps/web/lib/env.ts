// Runtime config. Next inlines NEXT_PUBLIC_* at build; lib/env.ts is the single place the web reads
// it. The MVP points at the API (apps/api) over the public oEmbed-only surface; no secret.
const DEFAULT_BASE = "http://localhost:8000";

export function apiBaseUrl(): string {
   // `process` is declared in types/web-env.d.ts (lean policy: no @types/node dependency).
   const v = process.env.NEXT_PUBLIC_API_BASE_URL;
   return (v && v.length > 0 ? v : DEFAULT_BASE).replace(/\/$/, "");
}

// Build a client-side fetch URL for an API path.
export function apiUrl(path: string, query?: Record<string, string | number | undefined>): string {
   const base = apiBaseUrl();
   const q = Object.entries(query || {})
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
   return `${base}${path}${q ? `?${q}` : ""}`;
}
