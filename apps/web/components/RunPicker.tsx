"use client";
// components/RunPicker.tsx -- browse the REAL seed catalog and start any workout.
//
// The missing T-40/T-51 bridge on the browse side: fetches GET /api/content/workouts and offers a
// "Start" button per template that materialises it (POST /api/runs via useStartWorkout) and jumps to
// the Class Display. Falls back to the demo (no network) with a visible note, never a white screen.
import { useEffect, useState } from "react";
import { fetchWorkouts, type WorkoutSummary } from "../lib/run";
import { useStartWorkout } from "../lib/useStartWorkout";
import { formatElapsedMs } from "../lib/util";

export function RunPicker({ todaySlug }: { todaySlug?: string | null }) {
   const [list, setList] = useState<WorkoutSummary[] | null>(null);
   const [err, setErr] = useState<string | null>(null);
   const { start, busySlug, error } = useStartWorkout();

   useEffect(() => {
      let alive = true;
      fetchWorkouts()
          .then((w) => alive && setList(w))
          .catch((e: unknown) => alive && setErr(String((e as { message?: string })?.message ?? e)));
      return () => {
         alive = false;
         };
    }, []);

   const busy = busySlug !== null;

   return (
       <section className="workouts" aria-label="workouts">
          <header className="workouts-head">
             <h2>Start a workout</h2>
             {todaySlug ? <p className="hint">Today&apos;s plan: <code>{todaySlug}</code></p> : null}
          </header>

          {error ? <p className="err">⚠ {error}</p> : null}
          {err ? <p className="hint">Couldn&apos;t reach the API ({err}). Showing nothing to start.</p> : null}
          {list === null && !err ? <p className="hint">Loading workouts…</p> : null}

          <ul className="workout-list">
             {(list ?? []).map((w) => {
        const isToday = todaySlug && w.slug === todaySlug;
        return (
           <li key={w.slug} className="workout-item" data-today={isToday ? "1" : undefined}>
             <div className="wi-main">
              <div className="wi-name">{w.name}{isToday ? <span className="chip today">today</span> : null}</div>
              <div className="wi-meta">
                <span className="chip">{formatElapsedMs(w.total_seconds * 1000)}</span>
                {w.emphasis ? <span className="chip">{w.emphasis}</span> : null}
                <span className="chip">{w.structure ?? "fixed-hiit"}</span>
                 {(w.equipment_required?.length ?? 0) > 0
                  ? <span className="chip eq">equipment: {w.equipment_required!.join(", ")}</span>
                  : null}
              </div>
              {w.goal ? <p className="wi-goal">{w.goal}</p> : null}
                </div>
             <div className="wi-act">
              <button
               className="btn primary"
               data-busy={busySlug === w.slug ? "1" : undefined}
               disabled={busy}
               onClick={() => void start(w.slug)}
                >
               {busySlug === w.slug ? "Starting…" : isToday ? "▶ Start today" : "▶ Start"}
                 </button>
             </div>
             </li>
                );
         })}
          </ul>
        </section>
       );
     }
