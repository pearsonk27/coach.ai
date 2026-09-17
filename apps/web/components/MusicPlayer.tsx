"use client";
// components/MusicPlayer.tsx -- T-43 music view. In MVP the embed is a SoundCloud preview URL; the real
// oEmbed embed comes from `GET /api/music/resolve` (hermetic echo). When no URL is resolved we render
// a "no music / silent" panel -- never a broken embed. The ducking itself lives in useAudioGraph
// (the cue feed ducks the music gain); this component surfaces the visual + the cue banner.
import type { Cue } from "@coach/ui";

export interface MusicPlayerProps {
   embedUrl: string | null;
   muted: boolean;
   loop: boolean;
   volume: number;
    ducked: boolean;
     activeCue: Cue | null;
      }

// A demo track so the view is runnable with zero backend. Replace with a resolved embedUrl.
const DEMO_EMBED = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F719402%26color%3D%23ff5500";

export function MusicPlayer({ embedUrl, muted, loop, volume, ducked, activeCue }: MusicPlayerProps) {
   const src = embedUrl || DEMO_EMBED;
    return (
       <section className="music" aria-label="music">
         <h2>Music</h2>
         <div className="music-state">
            <span className="chip">{ducked ? "ducked (countdown)" : "at full"}</span>
             <span className="chip">{muted ? "muted" : `vol ${(volume ?? 1).toFixed(2)}`}</span>
              <span className="chip">{loop ? "loop" : "no loop"}</span>
                {activeCue ? <span className="chip cue-cue">{activeCue.type}</span> : null}
                </div>
            <div className="music-frame">
              <iframe
                 title="music"
                 width="100%"
                 height="166"
                 loading="lazy"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                 frameBorder="0"
                />
                  </div>
        <p className="hint">
           {embedUrl ? "Resolved embed. " : "Demo embed (no resolved URL yet). "}
          SoundCloud oEmbed resolves via <code>GET /api/music/resolve</code>; cue audio ducks on the
          countdown through a single Web Audio gain (T-42).
          </p>
        </section>
       );
}
