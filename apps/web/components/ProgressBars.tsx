"use client";
// components/ProgressBars.tsx -- the two progress bars the design specifies (overall + current beat),
// each a simple determinate bar. Pure + prop-driven (no store).
import { clamp01 } from "../lib/util";

export interface ProgressBarsProps {
   overallFraction: number; // 0..1 across the whole run
    currentFraction: number; // 0..1 within the current beat
    label?: string;
     }

export function ProgressBars({ overallFraction, currentFraction, label }: ProgressBarsProps) {
   const overall = clamp01(overallFraction);
   const current = clamp01(currentFraction);
    return (
      <section aria-label="progress" className="progress-bars">
        <div className="bar" data-kind="overall">
           <div className="bar-fill" style={{ width: `${(overall * 100).toFixed(1)}%` }} />
           <span className="bar-label">{label ?? "Overall"}</span>
             </div>
        <div className="bar" data-kind="current">
           <div className="bar-fill" style={{ width: `${(current * 100).toFixed(1)}%` }} />
           <span className="bar-label">This beat</span>
             </div>
       </section>
   );
}
