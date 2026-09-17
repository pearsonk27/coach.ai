"use client";
// lib/useClock.ts -- the React/Expo timer that wraps @coach/ui's pure clock.
//
// Drives store.elapsedMs from wall-clock while the run is "playing"; holds on "paused"; freezes at
// the end when "ended". A nudge (control.offsetMs) is folded in once when it changes.
import { useEffect, useRef } from "react";
import { totalMs as totalMsOf } from "@coach/ui";
import { useWebStore } from "./store";

export function useClock(active: boolean): void {
   const rafRef = useRef<number | undefined>(undefined);
   const startRef = useRef<number | null>(null);
   const lastOffsetRef = useRef<number>(0);

    useEffect(() => {
      if (!active) return;
      let mounted = true;
       const tick = () => {
        if (!mounted) return;
        const s = useWebStore.getState();
        const total = totalMsOf(s.beats) || 0;
        const now =
            typeof performance !== "undefined" && performance.now
                ? performance.now()
                : Date.now();
        // A nudge changes how much wall time we count in.
        if (s.control.offsetMs !== lastOffsetRef.current) {
            s.setElapsed(Math.max(0, s.elapsedMs + (s.control.offsetMs - lastOffsetRef.current)));
            lastOffsetRef.current = s.control.offsetMs;
           }
        if (s.control.state === "playing" && s.control.ended === false) {
         if (startRef.current === null) startRef.current = now;
         const elapsed = s.elapsedMs + (now - startRef.current);
         startRef.current = now;
         s.setElapsed(Math.min(Math.max(0, elapsed), total || elapsed));
          if (elapsed >= total && total > 0) s.applyControl("end");
          } else {
            startRef.current = null;
             }
        rafRef.current =
            typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame(tick) : undefined;
         };
       const loop = () => {
        tick();
         };
       loop();
       return () => {
        mounted = false;
        if (rafRef.current !== undefined && typeof cancelAnimationFrame !== "undefined") {
            cancelAnimationFrame(rafRef.current);
             }
        };
      }, [active]);
}
