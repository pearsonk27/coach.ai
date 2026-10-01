"use client";
// app/play/page.tsx -- the RUNNABLE Class Display (player view).
//
// It owns loading a real workout so the class actually RUNS (timers + soundtrack), deterministically
// and refresh-safe. The workout slug comes from ?slug= (the picker writes it), defaulting to the
// upper-body HIIT -- so a fresh open of /play (or a refresh) replays the same run instead of the demo.
// The demo remains the ONLY path, taken when the API is unreachable (a down server must not leave a
// blank player).
import { useEffect, useRef, useState } from "react";
import { ClassDisplay } from "../../components/ClassDisplay";
import { useStartWorkout } from "../../lib/useStartWorkout";
import { useWebStore } from "../../lib/store";

// "Run the upper body HIIT" is the default intent; a picker can pass ?slug= to run a different template.
const DEFAULT_SLUG = "hiit-upper-30";

export default function PlayPage() {
   const { load, busySlug, error } = useStartWorkout();
   const [slug, setSlug] = useState<string | null>(null);
   const loaded = useRef(false);

   useEffect(() => {
      if (loaded.current) return;
      loaded.current = true;
       // Read the slug from the (client) URL -- avoids useSearchParams' Suspense requirement.
      const params = new URLSearchParams(window.location.search);
      const target = params.get("slug") || DEFAULT_SLUG;
      setSlug(target);
       // If the store already holds this real run (the picker just loaded it in-session), skip the
       // duplicate materialise; otherwise load it fresh (fresh open / refresh -> store is the demo).
      const s = useWebStore.getState();
      const alreadyReal =
         s.beats.length > 0 &&
         s.templateSlug === target &&
         !(s.runId ?? "").startsWith("demo-");
      if (!alreadyReal) void load(target);
      }, []);

   return (
       <>
         {error ? (
            <div className="demo-banner">
               <span>
                 Couldn&apos;t reach the API to load <code>{slug ?? DEFAULT_SLUG}</code> ({error.split(":")[0]}).
                   Showing the offline demo instead.
                </span>
                {busySlug ? <span className="chip">retrying…</span> : null}
              </div>
              ) : null}
        <ClassDisplay />
          </>
          );
    }
