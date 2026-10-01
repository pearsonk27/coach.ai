// Pure client embed resolution. Mirrors apps/web/lib/music.ts (type-erased; behavior must match).
const assert = require("node:assert");

function isSoundcloudUrl(url) {
   if (!url) return false;
   const low = url.trim().toLowerCase();
   return low.includes("soundcloud.com/");
}

function buildSoundcloudEmbedUrl(url, color = "#ff5500") {
   const s = (url ?? "").trim();
   if (!s) return null;
   let src = s;
   if (src.includes("soundcloud.com/player/") || src.includes("w.soundcloud.com/player/")) {
      const q = new URLSearchParams(src.split("?", 2)[1] || "");
      const inner = q.get("url");
      if (inner) src = inner;
   }
   if (!isSoundcloudUrl(src)) return null;
   let target = src;
   if (target.startsWith("soundcloud.com/")) target = "https://" + target.replace(/^[a-zA-Z]+:\/\//, "");
   target = target.split("?")[0];
   const q = new URLSearchParams();
   q.set("show_artwork", "true");
   q.set("visual", "true");
   q.set("color", color);
   q.set("url", target);
   return `https://w.soundcloud.com/player/?${q.toString()}`;
}

// isSoundcloudUrl
assert.ok(!isSoundcloudUrl(""), "empty -> false");
assert.ok(!isSoundcloudUrl("https://youtu.be/x"), "non-sc -> false");
assert.ok(!isSoundcloudUrl("https://soundcloud.com"), "bare host (no path) -> not embeddable");
assert.ok(isSoundcloudUrl("https://soundcloud.com/kris-pearson-2"), "a user handle w/ path -> sc");
assert.ok(isSoundcloudUrl("https://soundcloud.com/kris-pearson-2/sets/coach-we-hip-hop?si=abc&utm_source=x"), "a set w/ tracking -> sc");
assert.ok(!isSoundcloudUrl("https://example.com/set"), "non-sc host -> false");

// buildSoundcloudEmbedUrl
assert.strictEqual(buildSoundcloudEmbedUrl(""), null, "empty -> null");
assert.strictEqual(buildSoundcloudEmbedUrl(null), null, "null -> null");
assert.strictEqual(buildSoundcloudEmbedUrl("https://example.com/track"), null, "non-sc -> null");

const embed = buildSoundcloudEmbedUrl("https://soundcloud.com/kris-pearson-2/sets/coach-we-hip-hop?si=zzz&utm_source=clipboard");
assert.ok(embed, "produces an embed");
assert.ok(embed.startsWith("https://w.soundcloud.com/player/"), "points at w.soundcloud.com/player");
assert.ok(embed.includes("show_artwork=true"), "carries show_artwork");
assert.ok(embed.includes("visual=true"), "carries visual");
// tracking query must be stripped off the resolved target:
assert.ok(!embed.includes("si=zzz"), "strips si tracking");
assert.ok(!embed.includes("utm_source"), "strips utm tracking");
// the real resource path must survive as the (encoded) url= param:
assert.ok(decodeURIComponent(embed).includes("soundcloud.com/kris-pearson-2/sets/coach-we-hip-hop"), "url= carries the canonical set");

// re-pasting an embed unwraps to the same normalized embed (idempotent)
const inner = "https%3A%2F%2Fapi.soundcloud.com%2Fplaylists%2F2300510922";
const re = buildSoundcloudEmbedUrl("https://w.soundcloud.com/player/?visual=true&url=" + inner + "&show_artwork=true");
assert.ok(re, "unwraps an embed");
assert.ok(decodeURIComponent(re).includes("api.soundcloud.com/playlists/2300510922"), "keeps the inner playlist id");

// idempotent: building from an embed yields the same target
const a = buildSoundcloudEmbedUrl("https://soundcloud.com/kris-pearson-2/sets/coach-we-hip-hop");
const b = buildSoundcloudEmbedUrl(a);
assert.strictEqual(decodeURIComponent(b).split("url=")[1].split("&")[0], decodeURIComponent(a).split("url=")[1].split("&")[0], "idempotent on nested embeds");

// ---- applyPlaybackOptions (lib/music.ts): fold auto_play/loop into an embed idempotently ----
function applyPlaybackOptions(url, opts = {}) {
   const s = (url ?? "").trim();
   if (!s) return s;
   const sep = s.includes("?") ? "&" : "?";
   const add = [];
   if (opts.autoPlay && !/[?&]auto_play=/.test(s)) add.push("auto_play=true");
   if (opts.loop && !/[?&]loop=/.test(s)) add.push("loop=true");
   return add.length ? `${s}${sep}${add.join("&")}` : s;
}

// No URL -> no-op (never fabricates a base).
assert.strictEqual(applyPlaybackOptions(null, { autoPlay: true, loop: true }), "", "null -> empty");

// A query-bearing embed gets auto_play + loop appended.
const withPlay = applyPlaybackOptions(embed, { autoPlay: true, loop: true });
assert.ok(withPlay.includes("auto_play=true"), "appends auto_play");
assert.ok(withPlay.includes("loop=true"), "appends loop");
assert.ok(withPlay.includes(encodeURI("url=")), "keeps the existing url= param");

// Idempotent: a second pass doesn't double up the flags.
const twice = applyPlaybackOptions(withPlay, { autoPlay: true, loop: true });
assert.strictEqual((twice.match(/auto_play=/g) || []).length, 1, "auto_play not duplicated");
assert.strictEqual((twice.match(/loop=/g) || []).length, 1, "loop not duplicated");

// A base with no query uses "?" as the separator.
assert.strictEqual(applyPlaybackOptions("https://w.soundcloud.com/player/", { autoPlay: true }), "https://w.soundcloud.com/player/?auto_play=true", "bare base uses ? ");

// Opting out leaves the URL untouched.
assert.strictEqual(applyPlaybackOptions(embed, { autoPlay: false, loop: false }), embed, "no opts -> unchanged");

console.log("OK: web client SoundCloud embed resolver (client-side, offline-capable)");
