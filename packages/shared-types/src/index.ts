// T-01 — @coach/shared-types public surface.
//
// The canonical cross-language contract (I3). Re-exports the Zod schemas + their `z.infer`
// types. A Pydantic v2 mirror lives in `apps/api/app/contracts/schema.py`; a language-neutral
// snapshot lives in `../contract.snapshot.json`. `just check-contract` (I3) asserts all three
// agree on the per-type key/enum view.
//
// Import these everywhere (web / mobile / api-client / tests). Do NOT hand-author a
// `workout_run.beats` array at run time — it is the output of `buildTimeline` (I1, T-20).
export * from "./catalog.z";
export * from "./timeline.z";

// Bumped whenever the contract shape changes; the drift guard (I3) records it. The
// bootstrap version authored here is 1 (the contract that unblocks T-10/T-20/T-21/T-33).
export const CONTRACT_VERSION = 1 as const;
export type ContractVersion = typeof CONTRACT_VERSION;

// Convenience: the canonical run shape the API + clients exchange (D1).
export type {
    Beat,
   WorkBeat,
   WorkoutRun,
   WorkoutPhase,
   PhaseExercise,
   WorkoutTemplate,
   MusicRef,
   PlanSlot,
   PlanSlotParams,
} from "./timeline.z";
export type {
    Exercise,
    Equipment,
    MuscleGroup,
 } from "./catalog.z";
