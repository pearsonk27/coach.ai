#!/usr/bin/env node
// T-20 — buildTimeline (Node half of the two-language I1/I2 mirror).
//
// Pure, deterministic beat builder. The Python half lives at
// apps/api/app/engine/build_timeline.py (used by the API to materialise run.beats). Both
// consume the SAME oracle: the seed's stored `total_seconds`. I1: beats are BUILT here, never
// hand-authored. I2: sum(beats.durationMs) == template.total_seconds * 1000 for the un-scaled
// template (params == {}). Design D1/D2/D6.
//
// Closed form per phase (== the emission below):
//   phase_total = prep + rounds*work + (rounds-1)*rest + transition      (seconds)
// and total_seconds = Σ phase_total. Beats carry durationMs; a beat array with every second
// ×1000 sums to total_seconds*1000, so I2 follows by construction.
const _MS = 1000;

function scaleFloor(value, scale) {
   return Math.max(0, Math.round(value * scale));
}

function scaleRounds(rounds, roundsMult) {
   return Math.max(1, Math.round(rounds * roundsMult));
}

function paramsFrom(data) {
   const d = data || {};
   return {
      workScale: Number(d.work_scale ?? d.workScale ?? 1),
      restScale: Number(d.rest_scale ?? d.restScale ?? 1),
      roundsMult: Number(d.rounds_mult ?? d.roundsMult ?? 1),
   };
}

function workSeconds(item) {
   return Number("work_seconds" in item ? item.work_seconds : item.workSeconds ?? 0);
}

function cueFor(item, catalog) {
   const override = item.cue_override || item.cue;
   if (override) return String(override);
   if (catalog) {
      const ex = catalog[String(item.exercise)];
      if (ex && ex.cues && ex.cues.length) return String(ex.cues[0]);
   }
   return undefined;
}

function beatsForPhase(phase, catalog, p) {
   const beats = [];
   const pos = Number(phase.position);
   const prepSeconds = Number(phase.prep_seconds ?? phase.prepSeconds ?? 10);
   const restSeconds = Number(phase.rest_seconds ?? phase.restSeconds ?? 0);
   const transitionSeconds = Number(
      phase.transition_seconds ?? phase.transitionSeconds ?? 10,
   );
   const rounds = scaleRounds(Number(phase.rounds ?? 1), p.roundsMult);

   const prepMs = scaleFloor(prepSeconds, 1) * _MS; // prep is not scaled by D6 knobs
   const restMs = scaleFloor(restSeconds, p.restScale) * _MS;
   if (prepMs) beats.push({ id: `p${pos}-intro`, kind: "phase-intro", durationMs: prepMs });

   const items = [...(phase.items || [])].sort((a, b) =>
      a.position - b.position,
   );
   for (let r = 1; r <= rounds; r += 1) {
      for (const item of items) {
         const workMs = scaleFloor(workSeconds(item), p.workScale) * _MS;
         const beat = {
            id: `p${pos}-r${r}-e${item.position}`,
            kind: "work",
            durationMs: workMs,
            exerciseRef: item.exercise,
            round: r,
         };
         const cue = cueFor(item, catalog);
         if (cue) beat.cue = cue;
         beats.push(beat);
      }
      if (r < rounds && restMs) {
         beats.push({ id: `p${pos}-r${r}-rest`, kind: "rest", durationMs: restMs });
      }
   }

   if (transitionSeconds) {
      beats.push({
         id: `p${pos}-trans`,
         kind: "rest",
         durationMs: transitionSeconds * _MS,
      });
   }
   return beats;
}

function buildTimeline(template, params = undefined, catalog = undefined) {
   const p = paramsFrom(params);
   const phases = [...(template.phases || [])].sort((a, b) =>
      a.position - b.position,
   );
   const beats = [];
   for (const phase of phases) beats.push(...beatsForPhase(phase, catalog, p));
   return beats;
}

function totalMsOf(template, params = undefined) {
   return buildTimeline(template, params).reduce((n, b) => n + b.durationMs, 0);
}

function totalSecondsOf(template, params = undefined) {
   return Math.floor(totalMsOf(template, params) / _MS);
}

module.exports = {
   buildTimeline,
   totalMsOf,
   totalSecondsOf,
   scaleRounds,
   paramsFrom,
};
