"use client";
// app/me/page.tsx -- T-43 playlist / music config view.
import { useEffect, useState } from "react";
import { MusicPlayer } from "../../components/MusicPlayer";
import { resolveMusic, type TodayResult } from "../../lib/run";
import { useWebStore } from "../../lib/store";
import { cuesInWindow } from "@coach/ui";

export default function MePage() {
   const store = useWebStore();
   const [resolved, setResolved] = useState<{ embedUrl: string | null; loop: boolean; volume: number; muted: boolean } | null>(null);
    useEffect(() => {
      let alive = true;
      resolveMusic("default", null).then((r) => {
        if (alive) setResolved(r);
            }).catch(() => alive && setResolved({ embedUrl: null, loop: true, volume: 1, muted: false }));
      return () => {
        alive = false;
           };
        }, []);
   const cue = cuesInWindow(store.cues, 0, store.elapsedMs).slice(-1)[0] ?? null;
   return (
      <main className="me" aria-label="playlist">
        <h1>My playlist</h1>
        <MusicPlayer
          embedUrl={resolved?.embedUrl ?? store.music.embedUrl}
          muted={store.muted}
          loop={resolved?.loop ?? store.music.loop}
          volume={resolved?.volume ?? store.music.volume}
          ducked={cue ? (Math.min(1, store.music.volume ?? 1) * 0.3) < (store.music.volume ?? 1) * 0.999 : false}
          activeCue={cue ?? null}
          />
      </main>
   );
}

// keep the type import referenced (silences unused-type noise without a runtime dep).
export type _TodayRef = TodayResult;
