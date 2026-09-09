// @ts-check
// T-01 — canonical Zod contract, catalog side.
//
// This file is the canonical TS half of the cross-language contract (I3). A Pydantic
// v2 mirror lives in `apps/api/app/contracts/schema.py`; a language-neutral snapshot
// lives in `../contract.snapshot.json`. The drift guard (scripts/contract-drift.cjs,
// wired via `just check-contract`) asserts this side == the snapshot == the Py side.
//
// NOTE on run-time: `zod` is not yet installed in this tree (it lands when the contract
// runtime is provisioned — a STOP-D addendum; see T-01 handoff). The package's `typecheck`
// and `test` SKIP-green when zod is absent so the skeleton stays verifiable; `z.infer`
// compiles for real the moment zod is on disk. These files are reviewed as authored source.
import { z } from "zod";

// ---- catalog enums (design §0/§4/§6) --------------------------------------------

// PhaseType includes `mobility` (used by stretch-reset-15); the I4 5-phase ORDER
// invariant applies ONLY to `structure === "fixed-hiit"` templates (I7: tag, not a limit).
export const PhaseTypeEnum = z.enum([
   "warmup",
   "main_circuit",
   "accessory_circuit",
   "abs_cardio",
   "static_stretch",
   "mobility",
]);
export type PhaseType = z.infer<typeof PhaseTypeEnum>;

export const EmphasisEnum = z.enum(["upper", "lower", "fullbody", "recovery"]);
export type Emphasis = z.infer<typeof EmphasisEnum>;

export const MusicProviderEnum = z.enum(["user", "soundcloud"]);
export type MusicProvider = z.infer<typeof MusicProviderEnum>;

export const StartOnEnum = z.enum(["run_start", "on_join"]);
export type StartOn = z.infer<typeof StartOnEnum>;

export const RunStatusEnum = z.enum(["scheduled", "running", "paused", "completed", "aborted"]);
export type RunStatus = z.infer<typeof RunStatusEnum>;

export const RunSourceEnum = z.enum(["solo", "room"]);
export type RunSource = z.infer<typeof RunSourceEnum>;

export const PlanSlotKindEnum = z.enum(["active", "stretch", "hiit", "rest"]);
export type PlanSlotKind = z.infer<typeof PlanSlotKindEnum>;

export const StructureTagEnum = z.enum(["fixed-hiit", "freeform"]);
export type StructureTag = z.infer<typeof StructureTagEnum>;

// ---- content types --------------------------------------------------------------

// D7: a provider-abstracted, server-resolved music resource. MVP provider "user".
export const MusicRefSchema = z
   .object({
      provider: MusicProviderEnum, // required
      playlistRef: z.string().optional(), // snake: playlist_ref
      volume: z.number().min(0).max(1).optional(),
      startOn: StartOnEnum.optional(), // snake: start_on
   })
   .strict();
export type MusicRef = z.infer<typeof MusicRefSchema>;

// D6: per-slot periodization knobs; all optional (defaults live in buildTimeline, T-20).
export const PlanSlotParamsSchema = z
   .object({
      workScale: z.number().positive().optional(), // snake: work_scale
      restScale: z.number().positive().optional(), // snake: rest_scale
      roundsMult: z.number().positive().optional(), // snake: rounds_mult
      targetRpeFocus: z.number().int().min(1).max(10).optional(), // snake: target_rpe_focus
   })
   .strict();
export type PlanSlotParams = z.infer<typeof PlanSlotParamsSchema>;

// D6: a regimen slot; `kind === "rest"` ⇒ templateSlug is null/absent (design §4 CHECK).
export const PlanSlotSchema = z
   .object({
      slot: z.number().int(),
      kind: PlanSlotKindEnum,
      label: z.string().optional(),
      templateSlug: z.string().nullable().optional(), // snake: template_slug
      params: PlanSlotParamsSchema.optional(), // snake: params (JSONB default {})
   })
   .strict();
export type PlanSlot = z.infer<typeof PlanSlotSchema>;

export const EquipmentSchema = z
   .object({
      slug: z.string(),
      name: z.string(),
      iconName: z.string().optional(), // snake: icon_name
      isBuiltin: z.boolean().optional(), // snake: is_builtin
   })
   .strict();
export type Equipment = z.infer<typeof EquipmentSchema>;

export const MuscleGroupSchema = z
   .object({
      slug: z.string(),
      name: z.string(),
      region: z.string(),
   })
   .strict();
export type MuscleGroup = z.infer<typeof MuscleGroupSchema>;

export const ExerciseSchema = z
   .object({
      slug: z.string(),
      name: z.string(),
      description: z.string().optional(),
      cues: z.array(z.string()).default([]),
      difficulty: z.number().int().optional(),
      intensity: z.number().int().optional(),
      muscleGroups: z.array(z.string()).optional(), // snake: muscle_groups
      equipment: z.array(z.string()).optional(),
      gifUrl: z.string().optional().nullable(), // snake: gif_url (F-01)
   })
   .strict();
export type Exercise = z.infer<typeof ExerciseSchema>;
