"use client";
// components/InstructorRemote.tsx -- T-41 keyboard remote. On-screen buttons mirror the keyboard
// binding and post the same control command the store applies (T-50's store is the source of truth).
import { useEffect } from "react";
import { useWebStore, type ControlCommand } from "../lib/store";
import { apiBaseUrl } from "../lib/env";

export function InstructorRemote() {
   const store = useWebStore();
   const { control, runId, templateSlug } = store;

      // Keyboard binding: Space=pause/resume, arrow = jump-phase, +/- nudge, Esc=end.
   useEffect(() => {
     const onKey = (e: KeyboardEvent) => {
       switch (e.key) {
        case " ":
        case "Spacebar":
            e.preventDefault();
            store.applyControl(control.state === "paused" ? "resume" : "pause");
            break;
       case "ArrowRight":
            e.preventDefault();
            store.applyControl("jump-phase", { phase: (control.phase ?? -1) + 1 });
            break;
         case "+":
         case "=":
            e.preventDefault();
            store.applyControl("nudge", { delta: 30000 });
            break;
          case "-":
          case "_":
            e.preventDefault();
            store.applyControl("nudge", { delta: -30000 });
            break;
        case "Escape":
            e.preventDefault();
            store.applyControl("end");
            break;
         default:
            return;
            }
       };
      window.addEventListener("keydown", onKey);
       return () => window.removeEventListener("keydown", onKey);
          }, [store, control]);

    const cmd = (command: ControlCommand, label: string, title?: string) => (
         <button className="btn" title={title} onClick={() => store.applyControl(command)}>
            {label}
             </button>
      );
   return (
       <main className="instructor" aria-label="instructor remote">
         <h1>Instructor remote</h1>
         <p className="hint">
          Keyboard: <kbd>Space</kbd> pause/resume · <kbd>→</kbd> next phase · <kbd>+</kbd>/<kbd>-</kbd> nudge 30s · <kbd>Esc</kbd> end.
          {runId ? ` · run <code>${runId}</code>` : ` · template <code>${templateSlug ?? "demo"}</code> (no live run yet)`}
            </p>
          <div className="cmd-grid">
             {cmd(control.state === "paused" ? "resume" : "pause", "⏯ Play/Pause")}
             {cmd("jump-phase", "⏭ Next phase")}
             {cmd("nudge", "−30s", "nudge start −30s")}
            {cmd("nudge", "+30s", "nudge start +30s")}
            {cmd("end", "⏹ End")}
                </div>
         <dl className="ctrl-state">
           <dt>state</dt><dd>{control.state}</dd>
            <dt>phase</dt><dd>{String(control.phase)}</dd>
             <dt>offsetMs (nudge)</dt><dd>{String(control.offsetMs)}</dd>
                 <dt>api</dt><dd><code>{apiBaseUrl()}</code></dd>
                    </dl>
       </main>
   );
}
