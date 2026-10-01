"use client";
// app/page.tsx -- T-40 hub / landing: jump into today's real workout or browse the catalog, then link
// to the live surfaces. No side effects at build; fetches run on mount in the browser only.
import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchToday } from "../lib/run";
import { TodaySession } from "../components/TodaySession";
import { RunPicker } from "../components/RunPicker";

export default function HomePage() {
   const [todaySlug, setTodaySlug] = useState<string | null | undefined>(undefined);

   // Which template is "today" so the picker can highlight it. Best-effort; never blocks the page.
   useEffect(() => {
      let alive = true;
      fetchToday()
           .then((t) => alive && setTodaySlug((t.slot?.template_slug as string | null | undefined) ?? null))
           .catch(() => alive && setTodaySlug(null));
      return () => {
         alive = false;
          };
      }, []);

   return (
       <main className="home">
          <header className="home-hero">
             <h1>coach.ai</h1>
             <p className="muted">
                A web + mobile + TV-castable HIIT class player: a precomputed countdown, your playlist
                throughout, and a 3×30 + 1×15 week. No touches during playback.
             </p>
          </header>

          <section className="home-grid">
             <TodaySession />
             <RunPicker todaySlug={todaySlug ?? null} />
          </section>

          <nav className="nav" aria-label="surfaces">
             <Link href="/play" className="nav-item"><span className="k">play</span> Class Display</Link>
             <Link href="/class" className="nav-item"><span className="k">cast</span> Class Display (large)</Link>
             <Link href="/instructor" className="nav-item"><span className="k">remote</span> Instructor</Link>
             <Link href="/me" className="nav-item"><span className="k">music</span> My playlist</Link>
             <Link href="/cast" className="nav-item"><span className="k">cast</span> Tab-mirror</Link>
          </nav>

          <footer className="home-foot muted">
             The shared clock + cue scheduler + ducking math live in <code>@coach/ui</code>
             (type-safe, unit-tested); these pages are React views over it.
          </footer>
       </main>
      );
     }
