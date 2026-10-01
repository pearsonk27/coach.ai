"use client";
// app/me/page.tsx -- T-43 / F-08-mvp "My playlist". Paste a public SoundCloud URL (set/track/user); it
// resolves + plays CLIENT-SIDE (lib/music.ts) so it works with zero backend. We still POST the config to
// PATCH /api/music (best-effort) so a future account owns it, but a down server doesn't block playback.
import { useState } from "react";
import { MusicPlayer } from "../../components/MusicPlayer";
import { saveMusic } from "../../lib/run";
import { buildSoundcloudEmbedUrl } from "../../lib/music";
import { useWebStore } from "../../lib/store";
import { cuesInWindow } from "@coach/ui";

// A helpful, pre-fillable example: a public SoundCloud *set* the user can swap or clear.
const EXAMPLE_SET = "https://soundcloud.com/kris-pearson-2/sets/coach-we-hip-hop";

export default function MePage() {
   const store = useWebStore();
   const [url, setUrl] = useState<string>(EXAMPLE_SET);
   const [volume, setVolume] = useState<number>(1);
   const [loop, setLoop] = useState<boolean>(false);
   const [muted, setMuted] = useState<boolean>(false);
   const [status, setStatus] = useState<string | null>(null);
   const [savedOn, setSavedOn] = useState<"server" | "local" | null>(null);

    // A cue (in the demo clock window) flags the "ducked" chip in the player.
   const cue = cuesInWindow(store.cues, 0, store.elapsedMs).slice(-1)[0] ?? null;

   async function save() {
      setStatus(null);
      setSavedOn(null);
      // Best-effort persist to the (in-memory) account. A down server must not block playback.
      try {
         await saveMusic({ provider: "soundcloud", url: url.trim() || null, volume, loop, muted });
         setSavedOn("server");
         setStatus("Saved to this account.");
    } catch {
      setSavedOn("local");
      setStatus(url.trim() ? "Playing locally — server not reachable, config not persisted." : "Cleared locally.");
    }
        // Push the built embed + config into the shared store so /play & /class pick it up on
        // client-side navigation (the store is a module singleton; no full reload).
        store.setMusic({
          embedUrl: buildSoundcloudEmbedUrl(url.trim()) ?? store.music.embedUrl,
          volume,
          loop,
          muted,
        });
      }

   const ducked = cue ? true : false;

   return (
          <main className="me" aria-label="playlist">
            <h1>My playlist</h1>
            <p className="hint">
              Paste a <b>public</b> SoundCloud link — a <b>set</b> (playlist), a track, or a user page.
               It resolves + plays on the client (no login, no token — D8). A set must be public on
               SoundCloud.
            </p>

            <form className="sc-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
               <label className="field">
                 <span>SoundCloud URL</span>
                 <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://soundcloud.com/…/sets/…"
                  autoComplete="off"
                   />
                  <span className="hint">Example: <code>{EXAMPLE_SET}</code></span>
               </label>
                <div className="sc-options">
                  <label className="field inline">
                    <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
                     <span>Loop</span>
                    </label>
                    <label className="field inline">
                       <input type="checkbox" checked={muted} onChange={(e) => setMuted(e.target.checked)} />
                        <span>Muted</span>
                       </label>
                        <label className="field inline">
                          <span>Volume</span>
                           <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
                            <span className="chip">{volume.toFixed(2)}</span>
                           </label>
                          </div>
                           <div className="sc-actions">
                             <button type="submit" className="btn primary">▶ Play this URL</button>
                              <button type="button" className="btn ghost" onClick={() => setUrl("")}>Clear</button>
                               {status ? <span className={`status ${savedOn === "local" ? "warn" : ""}`}>{status}</span> : null}
                                </div>
                            </form>

                            <MusicPlayer
                              embedUrl={null}
                              sourceUrl={url}
                              muted={muted}
                              loop={loop}
                              volume={volume}
                              ducked={ducked}
                              activeCue={cue}
                              />

                             <p className="hint">
                                The player resolves your URL on the client, so it works even if the server
                                 isn't running. <code>PATCH /api/music</code> persists the config to your
                               in-memory account when the API is up (T-43/F-08); the OAuth auto-pull upgrade
                                 is F-08.
                            </p>
                             </main>
                        );
                         }
