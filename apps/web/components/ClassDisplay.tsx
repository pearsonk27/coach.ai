"use client";
// components/ClassDisplay.tsx -- T-40 Class Display: the runtime view. Big countdown ring, the current
// beat, an up-next strip, and a live cue banner -- driven by the live clock. It also binds T-41
// (instructor control state in the store) and T-42 (cues + ducking via useAudioGraph).
import { useRef, useState } from "react";
import { readClock, formatMSS, cuesInWindow, type Beat, type Cue, type WorkBeat } from "@coach/ui";
import { useWebStore } from "../lib/store";
import { useClock } from "../lib/useClock";
import { useAudioGraph } from "../lib/useAudioGraph";
import { upcomingWorkBeats, formatElapsedMs } from "../lib/util";
import { ProgressBars } from "./ProgressBars";

const KIND_LABEL: Record<string, string> = {
   "phase-intro": "Get ready",
   "prep": "Prep",
   "work": "Work",
   "rest": "Rest",
   "cooldown-hold": "Cool down",
};

export function ClassDisplay() {
   useClock(true);
   const audio = useAudioGraph(true);
   const store = useWebStore();
   const { beats, cues, elapsedMs, control, music, muted } = store;

   const clock = readClock(beats, elapsedMs);
   const overall = store.totalMs > 0 ? elapsedMs / store.totalMs : 0;
   const upnext = upcomingWorkBeats(beats, elapsedMs, 4);
   const beat = clock.current;
   const wb = workInfo(beat);

   // The most-recent cue that has crossed the clock is the one we show (banner + the tone that fired).
   const prevShown = useRef(0);
   const [shownCue, setShownCue] = useState<Cue | null>(null);
      {
      const due = cuesInWindow(cues, prevShown.current, elapsedMs);
      prevShown.current = elapsedMs;
      if (due.length > 0) setShownCue(due[due.length - 1]);
        }

     return (
       <main className="class-display" data-state={control.state}>
         <header className="class-header">
           <div className="title">{store.templateSlug ?? "demo session"}</div>
           <div className="state-pill">{control.state}</div>
           <div className="audio-note">
            {music.embedUrl ? "music: live" : "music: silent (no cue feed)"} · audio:{audio.cueFor(dueCue(cues, elapsedMs)).label}
             </div>
            </header>

         <section className="ring" aria-label="countdown">
           <div className="ring-num">{formatMSS(clock.remainingMs)}</div>
           <div className="ring-kind">{KIND_LABEL[beat.kind] ?? beat.kind}</div>
                <div className="ring-sub">
              {wb?.exerciseRef ? <span className="exercise">{wb.exerciseRef}</span> : null}
               {wb?.round ? <span className="round">· round {wb.round}</span> : null}
               {wb?.cue ? <span className="cue-text">{wb.cue}</span> : null}
                  </div>
             </section>

         <ProgressBars overallFraction={overall} currentFraction={clock.progress} />

         <aside className="up-next" aria-label="up next">
         <div className="up-next-title">Up next</div>
          <ul>
          {upnext.length === 0 && <li className="up-next-empty">No more work blocks</li>}
                  {upnext.map((b) => (
                     <li key={(b as WorkBeat).id}>
                 <span className="uex-name">{(b as WorkBeat).exerciseRef}</span>
                 {(b as WorkBeat).round ? <span className="uex-round">· r{(b as WorkBeat).round}</span> : null}
                      <span className="uex-dur">· {formatMSS(b.durationMs)}</span>
                         </li>
                        ))}
                 </ul>
                 </aside>

               {shownCue && (
                   <div className="cue-banner" data-emphasized={shownCue.emphasized ? "1" : "0"}>
                      <span className="cue-emoji">{cueEmoji(shownCue)}</span>
                       <span>{cueText(shownCue)}</span>
                         </div>
                         )}

            <footer className="controls">
               <button
                 onClick={() =>
                   store.setMuted(!muted)
                   }
                   className="btn"
                   aria-pressed={muted}
                     >
                    {muted ? "🔇 Muted" : "🔊 Music on"}
                        </button>
               <button className="btn" onClick={() => store.applyControl(control.state === "paused" ? "resume" : "pause")}>
                 {control.state === "paused" ? "▶ Resume" : "⏸ Pause"}
                               </button>
               <button className="btn ghost" onClick={() => void audio.ensureStarted()}>
                  🔊 Start audio
                                </button>
               <button className="btn ghost" onClick={() => store.applyControl("end")}>
                  ⏹ End
                               </button>
                 <div className="elapsed">elapsed {formatElapsedMs(elapsedMs)}</div>
                            </footer>
        </main>
     );
}

// local view helpers (pure, no store)
function workInfo(b: Beat): { exerciseRef?: string; cue?: string; round?: number } | null {
   if (b.kind !== "work") return null;
   return { exerciseRef: b.exerciseRef, cue: b.cue, round: b.round };
}
function dueCue(cues: Cue[], elapsedMs: number): Cue {
   let last: Cue | null = null;
   for (const c of cues) {
     if (c.atMs <= elapsedMs + 1) last = c;
     }
   return last ?? cues[0] ?? { atMs: 0, type: "phase-intro", n: 1 };
}
function cueEmoji(c: Cue): string {
 if (c.type === "workout-complete") return "🎉";
 if (c.type === "exercise-done") return "💪";
 if (c.type === "interval-count") return c.emphasized ? "🔥" : "•";
 return "⏱️";
}
function cueText(c: Cue): string {
 if (c.type === "workout-complete") return "You did it — session complete!";
 if (c.type === "exercise-done") return "Nice! On to the rest…";
 if (c.type === "interval-count") return c.emphasized ? `Last ${c.n ?? 1}!` : `${c.n ?? 1}…`;
   return `${c.type}`;
}

