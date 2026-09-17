"use client";
// app/cast/page.tsx -- T-60 "Cast tab-mirror": a self-documenting, graceful cast surface for the MVP.
// True Chromecast needs cast_sender.js (deferred); the MVP mirrors the display into a new tab so it
// is real and runnable without the cast protocol.
import { CastBar } from "../../components/CastBar";
import { ClassDisplay } from "../../components/ClassDisplay";

export default function CastPage() {
   return (
      <main className="cast" aria-label="cast">
        <div className="cast-head">
   <h1>Cast — tab mirror</h1>
   <CastBar />
     </div>
        <div className="cast-mirror">
          <ClassDisplay />
          </div>
   <p className="hint">
      This page is the cast target: point a TV browser (or a second tab) here. For true Chromecast
      device control, wire <code>cast_sender.js</code> (T-60 follow-up); the MVP uses a tab-mirror so
      the surface is real and runnable.
      </p>
   </main>
   );
}
