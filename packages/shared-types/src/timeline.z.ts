// @ts-check
// T-01 — canonical Zod contract, timeline side.
//
// A `WorkoutRun` is a *precomputed, deterministic* `Beat[]` + one `startedAtMs` (D1). Any
// device derives its state from `elapsed = now - startedAtMs`, so the beats are byte-identical
// for every device/room. I1: these beats are the OUTPUT of `buildTimeline(template, params)`
// (T-20) — never hand-authored at run time.
//
// See the header note in ./catalog.z.ts about the uninstalled `zod` runtime.
import { z } from "zod";
import {
    EmphasisEnum,
    MusicRefSchema,
    PhaseTypeEnum,
    StructureTagEnum,
} from "./catalog.z";

// D3/D10: the five beat kinds. A `work` beat is the only one that carries an
// `exerciseRef` (+ optional `cue`, `round`); the sustained/transition beats are timed holds.
const beatBase = z.object({
   id: z.string(),
   durationMs: z.number().int().nonnegative(),
});

export const PhaseIntroBeatSchema = beatBase
   .extend({ kind: z.literal("phase-intro") })
   .strict();
export const PrepBeatSchema = beatBase
   .extend({ kind: z.literal("prep") })
   .strict();
export const WorkBeatSchema = beatBase
   .extend({
     kind: z.literal("work"),
     exerciseRef: z.string(), // catalogue exercise slug
     cue: z.string().optional(),
     round: z.number().int().optional(),
   })
   .strict();
export const RestBeatSchema = beatBase
   .extend({ kind: z.literal("rest") })
   .strict();
export const CoolDownHoldBeatSchema = beatBase
   .extend({ kind: z.literal("cooldown-hold") })
   .strict();

export const BeatSchema = z.discriminatedUnion("kind", [
    PhaseIntroBeatSchema,
    PrepBeatSchema,
    WorkBeatSchema,
    RestBeatSchema,
    CoolDownHoldBeatSchema,
]);
export type Beat = z.infer<typeof BeatSchema>;
export type WorkBeat = z.infer<typeof WorkBeatSchema>;

// design §4 phase_exercise: position, exercise (slug), work_seconds, cue (cue_override).
export const PhaseExerciseSchema = z
   .object({
      position: z.number().int(),
      exercise: z.string(), // catalogue exercise slug (PhaseExercise uses `exercise`;
      // the runtime Beat uses `exerciseRef` — both are the same catalogue slug, keyed differently
      // by the two layers, per the contract's per-surface key map in contract.snapshot.json).
      workSeconds: z.number().int().positive(), // snake: work_seconds
      cue: z.string().optional(), // snake: cue (design alias: cue_override)
    })
    .strict();
export type PhaseExercise = z.infer<typeof PhaseExerciseSchema>;

// design §4 workout_phase.
export const WorkoutPhaseSchema = z
    .object({
      position: z.number().int(),
      phaseType: PhaseTypeEnum, // snake: phase_type
      title: z.string(),
      description: z.string().optional(),
      rounds: z.number().int().min(1).default(1),
      restSeconds: z.number().int().nonnegative().default(0), // snake: rest_seconds
      prepSeconds: z.number().int().nonnegative().default(10), // snake: prep_seconds
      transitionSeconds: z.number().int().nonnegative().default(10), // snake: transition_seconds
      items: z.array(PhaseExerciseSchema),
    })
    .strict();
export type WorkoutPhase = z.infer<typeof WorkoutPhaseSchema>;

// design §4 workout_template + seed (content-as-data, D4).
export const WorkoutTemplateSchema = z
    .object({
      slug: z.string(),
      name: z.string(),
      description: z.string().optional(),
      goal: z.string().optional(),
      structure: StructureTagEnum,
      structureVersion: z.number().int().default(1), // snake: structure_version
      totalSeconds: z.number().int().nonnegative(), // snake: total_seconds
      emphasis: EmphasisEnum.optional(),
      music: MusicRefSchema.optional(),
      source: z.string().optional(),
      phases: z.array(WorkoutPhaseSchema),
    })
    .strict();
export type WorkoutTemplate = z.infer<typeof WorkoutTemplateSchema>;

// The AI-loop substrate (D1/D4): a materialised run. `beats` are buildTimeline output (I1).
export const WorkoutRunSchema = z
    .object({
      id: z.string(),
      template: z.string(), // template slug (content-as-data); API/DB form is `template_id` (T-10)
      startedAtMs: z.number().int(), // snake: started_at_ms
      endedAtMs: z.number().int().optional(), // snake: ended_at_ms
      durationMs: z.number().int().nonnegative(), // snake: duration_ms
      status: z.enum(["scheduled", "running", "paused", "completed", "aborted"]),
      source: z.enum(["solo", "room"]),
      beats: z.array(BeatSchema),
    })
    .strict();
export type WorkoutRun = z.infer<typeof WorkoutRunSchema>;
