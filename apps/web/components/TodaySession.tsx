"use client";
// components/TodaySession.tsx -- T-51 "today's session" view: resolves today's slot on the plan cycle
// (server-side via /api/content/plans/{slug}/session, the pure todaySession resolver in @coach/ui)
// and now also STARTS it: "Start this workout" materialises the real template and loads the display.
// Falls back to a demo + visible note if the API is unreachable (no crash, no white screen).
import { useEffect, useState } from "react";
import { fetchToday, type TodayResult } from "../lib/run";
import { useStartWorkout } from "../lib/useStartWorkout";

// The API returns snake_case for the flattened slot (template_slug); the web keeps the loose shape
// here rather than forcing the camelCase ResolvedSlot type.
type ApiSlot = {
   kind: string;
   label?: string;
   template_slug?: string | null;
   params?: Record<string, unknown>;
};

interface TodayProps {
   planSlug?: string;
}

export function TodaySession({ planSlug = "fullbody-periodized" }: TodayProps) {
   const [data, setData] = useState<TodayResult | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [loaded, setLoaded] = useState(false);
   const { start, busySlug, error: startError } = useStartWorkout();

   useEffect(() => {
      let alive = true;
      fetchToday(planSlug)
          .then((r: TodayResult) => {
            if (alive) setData(r);
            setLoaded(true);
            })
              .catch((e: unknown) => {
               if (alive) setError(String((e as { message?: string })?.message ?? e));
               setLoaded(true);
                });
      return () => {
          alive = false;
          };
     }, [planSlug]);

    if (error) {
      return (
            <main className="today err" aria-label="today">
               <h1>Today&apos;s session</h1>
               <p className="note">API unreachable ({error}). Showing a demo slot.</p>
               <DemoSlot />
               </main>
         );
     }
   if (!data || !loaded) {
      return (
           <main className="today loading" aria-label="today">
               <h1>Today&apos;s session</h1>
               <p className="note">Resolving today&apos;s slot on the plan cycle…</p>
               </main>
         );
      }
   const slot: ApiSlot | null = data.slot;
   const startable = !!slot?.template_slug && !data.isRest;
   return (
        <main className="today" aria-label="today">
           <h1>Today&apos;s session</h1>
           <p className="meta">
              {data.date} · cycle day {String(data.dayOfWeek)} · slot {String(data.slotIndex)}
              {data.isRest ? " · REST" : ""}
            </p>
           <div className="slot">
              <div className="slot-kind">{slot?.kind ?? "open"}</div>
              <div className="slot-name">{slot?.label ?? "Free / open"}</div>
              <div className="slot-template">
                 {slot?.template_slug ? <code>{slot.template_slug}</code> : <span className="muted">no template</span>}
              </div>
              {slot?.params && Object.keys(slot.params).length > 0 && (
                 <pre className="slot-params">{JSON.stringify(slot.params, null, 2)}</pre>
              )}
            </div>

           {startable ? (
              <div className="today-start">
                 <button
                    className="btn primary"
                    data-busy={busySlug === slot!.template_slug ? "1" : undefined}
                    disabled={busySlug !== null}
                    onClick={() => void start(slot!.template_slug!)}
                 >
                    {busySlug === slot!.template_slug ? "Starting real workout…" : "▶ Start this workout"}
                 </button>
                 {busySlug && busySlug !== slot!.template_slug ? <span className="hint">starting…</span> : null}
              </div>
           ) : data.isRest ? (
              <p className="hint">Rest day — no workout scheduled. Come back tomorrow.</p>
           ) : null}

           {startError ? <p className="err">⚠ {startError}</p> : null}
        </main>
     );
   }

function DemoSlot() {
    return (
        <div className="slot demo">
           <div className="slot-kind">workday</div>
           <div className="slot-name">HIIT Upper (demo)</div>
           <div className="slot-template"><code>hiit-upper-30</code></div>
       </div>
     );
   }
