"use client";
// lib/useStartWorkout.ts -- start a REAL seed workout and load it into the shared store.
//
// This is the T-40/T-51 bridge. Two entry points:
//  * `load(slug)` materialises a template server-side (POST /api/runs, I2-guarded) and loads its beats
//    into the store *without navigating* -- the /play page calls this on mount so the workout is
//    URL-driven and refresh-safe (the demo is only the offline fallback).
//  * `start(slug)` is the same + a navigation to /play?slug= for the in-session handoff, used by the
//    browse picker. /play guards against a duplicate materialise when the store already holds the run.
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { startRun } from "./run";
import { useWebStore } from "./store";

export interface StartWorkoutApi {
   load: (slug: string) => Promise<boolean>;
   start: (slug: string) => void;
   busySlug: string | null;
   error: string | null;
}

export function useStartWorkout(): StartWorkoutApi {
   const router = useRouter();
    // Only pull the stable action off the store (never the whole run) to avoid re-render churn.
   const setRun = useWebStore((s) => s.setRun);
   const [busySlug, setBusySlug] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);

   const load = useCallback(
       async (slug: string) => {
        setBusySlug(slug);
        setError(null);
        try {
          // Materialise the real template server-side (I2-guarded) and load its beats.
        const res = await startRun(slug, "default");
        setRun(res.beats, res.rid, slug);
        return true;
          } catch (e: unknown) {
        setError(`Could not start ${slug}: ${String((e as { message?: string })?.message ?? e)}. Is the API up at the configured base URL?`);
        return false;
         } finally {
        setBusySlug(null);
         }
        },
        [setRun],
     );

   // The picker path: load it, then hand off to /play carrying the slug (so a refresh keeps the run).
   const start = useCallback((slug: string) => {
       void load(slug);
       router.push(`/play?slug=${encodeURIComponent(slug)}`);
      }, [load, router]);

   return { start, load, busySlug, error };
}
