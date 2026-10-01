"use client";
// components/WorkoutMusic.tsx -- the in-class soundtrack, with REAL cue ducking.
//
// It renders the run's playlist (the store's `music`, seeded to the caller's own set) under the
// countdown AND ducks that *actual* playlist at the cue points. An <iframe> embed is opaque, so we
// don't fake a gain on a stand-in tone -- we drive SoundCloud's own Web Player API
// (`SC.Widget.setVolume`, 0..100) from the duck bus the audio hook feeds from `musicGain()`. The
// result: during the last 10 s of each work block the music dips to ~30% (the "appropriately lowered
// around the exercise alert") and restores on the count, smoothly. Duck is best-effort: if the player
// API is unavailable the music still plays.
import { useEffect, useRef, useState } from "react";
import type { Cue } from "@coach/ui";
import { resolveEmbedFor, applyPlaybackOptions, DEMO_EMBED } from "../lib/music";
import { onDuck, duckVolumePercent, duckRampSchedule } from "../lib/musicDuck";
import type { MusicPlayback } from "../lib/types";

// The SoundCloud Web Player API (classic 2.x). Loaded once; the duck route degrades if absent.
const SC_API = "https://w.soundcloud.com/player/api.js";

// The duck ramp shape: short + gentle so a full-dip reads as a smooth pull, not a jump.
const RAMP = { totalMs: 160, steps: 5 };

function sc(): { Widget?: (x: unknown) => UnknownWidget } | null {
   if (typeof window === "undefined") return null;
   const w = window as unknown as { SC?: { Widget?: (x: unknown) => UnknownWidget } };
   return w.SC ?? null;
}

// Load api.js once and resolve to the `SC` global, or null (never rejects -> the play loop can't hang).
function loadScApi(): Promise<{ Widget?: (x: unknown) => UnknownWidget } | null> {
   if (typeof window === "undefined") return Promise.resolve(null);
   const w = window as unknown as { SC?: { Widget?: (x: unknown) => UnknownWidget } };
   if (w.SC && w.SC.Widget) return Promise.resolve(w.SC);
   return new Promise((resolve) => {
      if (document.getElementById("sc-api")) {
       const poll = () => (w.SC && w.SC.Widget ? resolve(w.SC) : setTimeout(poll, 40));
        poll();
         return;
        }
      const s = document.createElement("script");
       s.id = "sc-api";
       s.src = SC_API;
        s.async = true;
       s.onload = () => resolve(w.SC ?? null);
       s.onerror = () => resolve(null);
        document.body.appendChild(s);
          });
}

type UnknownWidget = {
   setVolume: (v: number) => void;
   play: () => void;
   pause: () => void;
   bind: (event: string, cb: () => void) => void;
   getStatus?: (cb: (s: string) => void) => void;
};

export interface WorkoutMusicProps {
   music: MusicPlayback;
   controlState: string;
   activeCue: Cue | null;
   onStart: () => void | Promise<void>;
}

export function WorkoutMusic({ music, controlState, activeCue, onStart }: WorkoutMusicProps) {
   const [playKey, setPlayKey] = useState(0);
   const [starting, setStarting] = useState(false);
   const [level, setLevel] = useState(1);

   // Live refs the duck route reads so the rAF-driven bus callbacks don't capture stale props.
   const frameRef = useRef<HTMLIFrameElement | null>(null);
   const widgetRef = useRef<UnknownWidget | null>(null);
   const baseRef = useRef(music.volume ?? 1);
   const volRef = useRef(0);
   const pendingRef = useRef(100);
   const rampTokens = useRef(0);
   baseRef.current = music.volume ?? 1;

   const playing = controlState === "playing";
   const notMuted = !music.muted;
   // A fresh iframe mount on each explicit start gives the browser a clean autoplay gesture.
   const resolved = resolveEmbedFor(music.embedUrl, undefined, DEMO_EMBED);
   const src = applyPlaybackOptions(resolved.src, { autoPlay: playing && notMuted, loop: music.loop });
   const kind = resolved.kind;
   const ducked = level < 0.95;

   // Bind the player's own Web Player API to our iframe, and apply any pending volume on `ready`.
   useEffect(() => {
      let cancelled = false;
      const bindWidget = async () => {
        await loadScApi();
        if (cancelled) return;
         const api = sc();
         const frame = frameRef.current;
         if (!api?.Widget || !frame) return;
       const wdg = api.Widget(frame);
        widgetRef.current = wdg;
       const applyPending = () => {
        if (rampTokens.current !== 0) return; // a ramp is in flight; it owns the final value
         wdg.setVolume(pendingRef.current);
          volRef.current = pendingRef.current;
          };
        wdg.bind("ready", applyPending);
        wdg.bind("notification", applyPending); // first status notification ~ "ready"
       applyPending();
          };
      void bindWidget();
       return () => {
        cancelled = true;
          };
         },
     // Re-bind when the source or the gesture-reload key changes (a new iframe is mounted).
      [src, playKey]);

   // Route the duck bus to the player. The bus only notifies on a quantised change, so this is cheap.
   useEffect(() => {
      const applyTarget = (target: number) => {
        const wdg = widgetRef.current;
        if (!wdg) {
         pendingRef.current = target; // not ready yet; applied on "ready"
         setLevel(target / 100);
         return;
          }
        // Short, evenly-stepped ramp so the dip is smooth (the web player can't ramp itself).
       const stop = ++rampTokens.current;
       const schedule = duckRampSchedule(volRef.current, target, RAMP);
       if (schedule.length === 0) {
        rampTokens.current = 0;
        setLevel(target / 100);
        return;
        }
       for (const stop_ of schedule) {
        window.setTimeout(() => {
          if (rampTokens.current !== stop || widgetRef.current !== wdg) return;
           wdg.setVolume(stop_.pct);
            volRef.current = stop_.pct;
            if (stop_.pct === target) {
               rampTokens.current = 0;
              setLevel(target / 100);
                 }
               });
          }
        };
      const unsub = onDuck((l) => applyTarget(duckVolumePercent(baseRef.current, l)));
       return () => {
        unsub();
         // Cancel any in-flight ramp so it can't keep writing after the player unmounts.
        rampTokens.current = ++rampTokens.current;
            };
       }, [music.volume]);

  async function handleStart() {
      setStarting(true);
      try {
        await onStart();
        // Re-mount the iframe under the just-happened gesture so the browser admits the autoplay,
         // and ask the loaded widget to play (best-effort).
        setPlayKey((k) => k + 1);
        widgetRef.current?.play();
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
            <span className={`chip ${kind}`}>
             {kind === "resolved" ? "your playlist" : kind === "client" ? "live (client)" : "demo embed"}
                </span>
            <span className={`chip ${ducked ? "duck" : ""}`}>
            {ducked ? `ducked ${Math.round(level * 100)}%` : "at full"}
            </span>
            <span className="chip">{music.muted ? "muted" : `vol ${Math.round(baseRef.current * 100)}%`}</span>
            <span className="chip">{music.loop ? "loop" : "no loop"}</span>
            {activeCue ? <span className="chip cue-cue">{activeCue.type}</span> : null}
            </div>
          <div className="music-frame">
            {/* key forces a fresh iframe when the source/gesture changes; the Web Player API binds to it. */}
            <iframe
            key={`${src}-${playKey}`}
            ref={frameRef}
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
              Your playlist plays under the countdown and <b>ducks to ~30%</b> during each 5-count.
                 Press <b>🔄 Restart music</b> if your browser held the autoplay.
                  </p>
        ) : (
           <p className="hint">Press <b>▶ Start class</b> to play the countdown and your playlist together.</p>
          )}
          </section>
    );
}
