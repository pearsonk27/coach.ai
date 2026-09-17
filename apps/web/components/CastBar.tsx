"use client";
// components/CastBar.tsx -- T-60 cast control. MVP: a tab-mirror (open the display in a new tab). The
// real Chromecast path (cast_sender.js) is a deferred follow-up; the button never throws when the
// browser lacks the API.
import { useWebStore } from "../lib/store";

export function CastBar() {
   const store = useWebStore();
   const castTarget = typeof window !== "undefined" ? `${window.location.origin}/class` : "/class";

    const openMirror = () => {
        try {
        window.open(castTarget, "coach-cast", "noopener,width=800,height=1000");
        } catch {
         // popup blocked / no window -> leave it; the /cast route is still usable.
        }
     };
   return (
      <div className="cast-bar" aria-label="cast">
         <button className="btn" onClick={openMirror}>📺 Cast / open mirror</button>
         <span className="cast-target">
     target <code>{castTarget}</code>
              </span>
        <span className={`state ${store.control.state}`}>{store.control.state}</span>
      </div>
     );
}
