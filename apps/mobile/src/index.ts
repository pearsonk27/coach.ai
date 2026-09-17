// src/index.ts -- the mobile entry surface (what the real App.tsx renders from).
//
// Pure selectors over @coach/ui -- no RN import here so this module typechecks without the Expo
// runtime installed. A next step adds `App.tsx` (RN JSX) that wires `viewState` to a screen,
// `todayFor` to the Today tab, and `duckLevel` to an AudioContext gain node.
export * from "./mobile-model";
