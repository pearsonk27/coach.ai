"use client";
// components/MusicPlayer.tsx -- T-43 music view.
//
// The embed is resolved CLIENT-SIDE (lib/music.ts) so a pasted public SoundCloud set plays even when the
// Python API isn't running (the `just dev` default). A server-resolved embed (from /api/music/resolve)
// wins when present; otherwise a client-built embed from the source; otherwise the demo embed.
//
// The cue-feed ducking lives in useAudioGraph (it rides a Web Audio gain through T-42); this view just
// surfaces the embed + the cue/duck state.
import type { Cue } from "@coach/ui";
import { resolveEmbedFor } from "../lib/music";

export interface MusicPlayerProps {
   embedUrl: string | null | undefined;
   sourceUrl?: string | null | undefined;
   muted: boolean;
   loop: boolean;
   volume: number;
   ducked: boolean;
   activeCue: Cue | null;
}

// A demo embed so the view is runnable with zero URL + no backend.
const DEMO_EMBED = "https://w.soundcloud.com/player/?show_artwork=true&visual=true&url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F719402";

export function MusicPlayer({
   embedUrl,
   sourceUrl,
   muted,
   loop,
   volume,
   ducked,
   activeCue,
}: MusicPlayerProps) {
     const { src, kind } = resolveEmbedFor(embedUrl, sourceUrl, DEMO_EMBED);
    return (
          <section className="music" aria-label="music">
            <h2>Music</h2>
            <div className="music-state">
               <span className={`chip ${kind}`}>{kind === "resolved" ? "resolved" : kind === "client" ? "live (client)" : "DEMO embed"}</span>
               <span className="chip">{ducked ? "ducked (countdown)" : "at full"}</span>
               <span className="chip">{muted ? "muted" : `vol ${(volume ?? 1).toFixed(2)}`}</span>
               <span className="chip">{loop ? "loop" : "no loop"}</span>
               {activeCue ? <span className="chip cue-cue">{activeCue.type}</span> : null}
               </div>
             <div className="music-frame">
               {/* key forces a fresh iframe when the source changes (client-side re-resolution). */}
              <iframe
                key={src}
                 title="music"
                 src={src}
                width="100%"
                 height="166"
                loading="lazy"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                />
                 </div>
              <p className="hint">
                 {kind === "resolved"
                   ? "Server-resolved embed."
                   : kind === "client"
                        ? "Playing your pasted SoundCloud URL client-side (no backend needed). No token (D8)."
                        : "No URL yet — showing the demo embed. Paste a public SoundCloud set/track URL on /me."}
                Cue tones duck the gain on the countdown through a single Web Audio gain (T-42).
               </p>
            </section>
         );
         }
