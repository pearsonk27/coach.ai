// T-00 placeholder. T-01 authors the canonical Zod contract (Beat, WorkoutRun,
// WorkoutPhase, PhaseExercise, MusicRef, PlanSlot.params + catalog enums).
// CONTRACT_VERSION bumps whenever the schema changes; the drift guard (I3) uses it.
export const CONTRACT_VERSION = 0 as const;
export type ContractVersion = typeof CONTRACT_VERSION;
