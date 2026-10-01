"use client";
// components/WorkoutMusic.tsx -- the in-class soundtrack for the Class Display.
//
// This is the piece that was missing: /play ran the timers + cues but never rendered a player, so the
// workout had no music. This panel plays the run's playlist (the store's `music`) right under the
// countdown. The embed is resolved client-side (lib/music.ts) so "my playlist" runs even when the
// Python API is down; a server-resolved embed wins when present.
//
// Autoplay honesty: browsers block cross-origin iframe audio until a user gesture, so we attempt
// auto_play and also give one explicit "▶ Start class" button that resumes the Web Audio graph and
// re-mounts the iframe (a gesture-scoped navigation) so the track actually comes up. Loop + mute ride
// the same store `music` config the timers' cue tones duck against (useAudioGraph).
import { useState } from "react";
import type { Cue } from "@coach/ui";
import { resolveEmbedFor, applyPlaybackOptions, DEMO_EMBED } from "../lib/music";
import type { MusicPlayback } from "../lib/types";

export interface WorkoutMusicProps {
   music: MusicPlayback;
   controlState: string;
   ducked: boolean;
   activeCue: Cue | null;
   onStart: () => void | Promise<void>;
}

export function WorkoutMusic({ music, controlState, ducked, activeCue, onStart }: WorkoutMusicProps) {
   const [playKey, setPlayKey] = useState(0);
   const [starting, setStarting] = useState(false);

   const playing = controlState === "playing";
   const notMuted = !music.muted;
   // A fresh iframe mount on each explicit start gives the browser a clean autoplay gesture.
   const resolved = resolveEmbedFor(music.embedUrl, undefined, DEMO_EMBED);
   const src = applyPlaybackOptions(resolved.src, { autoPlay: playing && notMuted, loop: music.loop });
   const kind = resolved.kind;

   async function handleStart() {
      setStarting(true);
      try {
        await onStart();
        setPlayKey((k) => k + 1); // re-mount under the just-happened gesture
        } finally {
        setStarting(false);
         }
   }

   return (
      <section className="music workout-music" aria-label="workout music">
        <div className="wm-head">
           <h2>Soundtrack</h2>
           {playing && notMuted ? (
              <button className="btn ghost" onClick={() => void handleStart()} aria-busy={starting}>
                🔄 Restart music
                 </button>
              ) : (
              <button className="btn primary" onClick={() => void handleStart()} aria-busy={starting}>
                {starting ? "Starting…" : "▶ Start class"}
                 </button>
            )}
         </div>
         <div className="music-state">
            <span className={`chip ${kind}`}>{kind === "resolved" ? "your playlist" : kind === "client" ? "live (client)" : "demo embed"}</span>
            <span className="chip">{ducked ? "ducked (countdown)" : "at full"}</span>
            <span className="chip">{music.muted ? "muted" : `vol ${(music.volume ?? 1).toFixed(2)}`}</span>
            <span className="chip">{music.loop ? "loop" : "no loop"}</span>
            {activeCue ? <span className="chip cue-cue">{activeCue.type}</span> : null}
         </div>
         <div className="music-frame">
            {/* key forces a fresh iframe when the source changes; playKey bumps it under the start
                gesture so the browser allows autoplay on the class's soundtrack. */}
            <iframe
            key={`${src}-${playKey}`}
             title="workout music"
             src={src}
            width="100%"
            height="166"
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            />
	       </div>
          {music.muted ? (
            <p className="hint">🔇 Muted — un-mute the class (footer) and press <b>▶ Start class</b> to hear your playlist.</p>
            ) : playing ? (
            <p className="hint">
               {kind === "demo"
                  ? "Showing the demo soundtrack. Set your playlist on <code>/me</code> — it carries here automatically."
                  : "Your playlist plays underneath the countdown; cue tones duck it on the 5-count. Press <b>🔄 Restart music</b> if your browser held the autoplay."}
               </p>
              ) : (
            <p className="hint">Press <b>▶ Start class</b> to play the countdown timers and your playlist together.</p>
           )}
        </section>
      );
   }
