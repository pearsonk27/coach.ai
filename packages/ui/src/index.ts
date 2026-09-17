// T-21/T-31/T-40/T-42/T-51 — pure clock + cue/ducking + session math. React/Expo wrappers are
// deps-pending (no react yet in packages/ui). Everything here is transport-agnostic + unit-tested
// in Node; the apps/web hook (useAudioGraph) + views consume these.
export * from "./clock";
export * from "./audio-cues";
export * from "./session-today";
