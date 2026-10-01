// lib/music.ts -- PURE, client-side SoundCloud embed resolution.
//
// The MVP "paste a public SoundCloud URL" path needs zero backend: a public SoundCloud *set/track/user*
// URL maps deterministically to a public embed URL (https://w.soundcloud.com/player/?show_artwork=true&
// visual=true&url=<encoded>). We do this on the client so the /me playlist works even when the Python
// API (apps/api) isn't running -- which is the default under `just dev` (turbo only starts the web).
//
// The API's `GET /api/music/resolve` / `PATCH /api/music` (T-43/F-08) remain the source of truth for
// *saving* a playlist to an account; this module is the immediate, offline-capable resolver the UI uses.
// It mirrors apps/api/app/api/music.py so the two never diverge (behavior asserted in test/music.test.cjs).

export function isSoundcloudUrl(url: string | null | undefined): boolean {
   if (!url) return false;
   const low = url.trim().toLowerCase();
    // A bare host with no path isn't embeddable; any soundcloud.com/* resource path is.
   // (Mirrors the server's substring check in api/app/api/music.py.)
   return low.includes("soundcloud.com/");
}

// Build a public SoundCloud embed URL. Accepts a SoundCloud URL *or* an embed URL (the latter is
// normalized so re-pasting an embed still plays). Non-SoundCloud URLs return null (the caller decides
// whether to show a demo embed).
export function buildSoundcloudEmbedUrl(url: string | null | undefined, color = "#ff5500"): string | null {
   const s = (url ?? "").trim();
   if (!s) return null;
   let src = s;

   // If they pasted an embed URL, unwrap it back to the source track/playlist for a clean, normalized embed.
   if (src.includes("soundcloud.com/player/") || src.includes("w.soundcloud.com/player/")) {
      const q = new URLSearchParams(src.split("?", 2)[1] || "");
      const inner = q.get("url");
      if (inner) src = inner;
   }

   if (!isSoundcloudUrl(src)) return null;

   // Normalize to a canonical https URL (the embed loader resolves canonical /sets/, /tracks/, user URLs).
   let target = src;
   if (target.startsWith("soundcloud.com/")) target = "https://" + target.replace(/^[a-zA-Z]+:\/\//, "");
   // Strip tracking query (?si=…&utm_…) — it bloats the embed and isn't part of the resource.
   target = target.split("?")[0];

   const q = new URLSearchParams();
   q.set("show_artwork", "true");
   q.set("visual", "true");
   q.set("color", color);
   q.set("url", target);
   return `https://w.soundcloud.com/player/?${q.toString()}`;
}

// The best embed to render for a given (optional) saved server embed + a pasted/raw source URL.
// Priority: server-resolved embed > client-built embed from the source > a demo embed.
export function resolveEmbedFor(
   serverEmbedUrl: string | null | undefined,
   sourceUrl: string | null | undefined,
   demoEmbed: string,
): { src: string; source: string | null; kind: "resolved" | "client" | "demo" } {
   if (serverEmbedUrl) return { src: serverEmbedUrl, source: sourceUrl ?? null, kind: "resolved" };
   const built = sourceUrl ? buildSoundcloudEmbedUrl(sourceUrl) : null;
   if (built) return { src: built, source: sourceUrl ?? null, kind: "client" };
   return { src: demoEmbed, source: null, kind: "demo" };
}

// The user's own playlist (their public SoundCloud set). This is "my playlist" for a workout: it is
// the default the store seeds so the class has music from the first tap, and it is what /me opens
// pre-filled. Swap it here (or via /me) to change what plays during a run.
export const DEFAULT_PLAYLIST_URL = "https://soundcloud.com/kris-pearson-2/sets/coach-we-hip-hop";

// A ready-to-play embed for the user's default playlist (no backend needed).
export function defaultPlaylistEmbed(): string {
   return buildSoundcloudEmbedUrl(DEFAULT_PLAYLIST_URL) ?? "";
}

// A demo embed so the view is runnable with zero URL + no backend. Shared by the /me player and the
// in-class music panel so the fallback is identical everywhere.
export const DEMO_EMBED =
   "https://w.soundcloud.com/player/?show_artwork=true&visual=true&url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F719402";

// Fold playback intent (auto_play / loop) into an embed URL idempotently. SoundCloud's HTML5
// player reads these from the query string; appending them lets the class auto-start + loop the
// source so "my playlist" actually runs underneath the countdown. No-op on a null/empty url.
export function applyPlaybackOptions(
   url: string | null | undefined,
   opts: { autoPlay?: boolean; loop?: boolean } = {},
): string {
   const s = (url ?? "").trim();
   if (!s) return s;
   const sep = s.includes("?") ? "&" : "?";
   const add: string[] = [];
   if (opts.autoPlay && !/[?&]auto_play=/.test(s)) add.push("auto_play=true");
   if (opts.loop && !/[?&]loop=/.test(s)) add.push("loop=true");
   return add.length ? `${s}${sep}${add.join("&")}` : s;
}
