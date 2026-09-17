# @coach/mobile — Expo + React Native HIIT player (T-70)

MVP status: **typecheck-only shell**. It proves the central architectural point of T-70 — the mobile
app is a *thin shell over `@coach/ui`'s shared pure core* — without pulling the Expo/React-Native
runtime (which cannot be built or runtime-tested headlessly).

## What ships now
- `src/mobile-model.ts` — pure selectors that consume the **same** `@coach/ui` functions the web uses:
  `readClock` (clock), `planCues` (cue schedule), `duckLevelAt` (music ducking), `todaySession`
  (today's slot), `formatMSS`. No React Native / Expo import, so it typechecks in isolation.
- `src/index.ts` — the entry surface the real `App.tsx` will render from.

## What's deferred (next step)
- `App.tsx` (RN JSX + navigation tab: Class Display / Today / Music), a `useWorkoutClock` hook over
  the Web Audio `AudioContext`, and a real `viewState`-driven countdown screen. These need the Expo
  runtime, which is intentionally **not** installed (lean dependency policy — see design doc §T-70).
- Music playback on mobile: reuse `duckLevel` to fade an `AVAudioPlayer`/Expo-Audio gain, mirroring
  the web's `useAudioGraph` cue feed.

## Typecheck
```
cd ../../ && npx tsc -p apps/mobile/tsconfig.json --noEmit
```
