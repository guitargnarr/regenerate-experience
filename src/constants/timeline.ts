/**
 * Centralized timeline constants for Regenera.
 *
 * Single source of truth for all scene timing, transition zones,
 * text overlay windows, camera behavior, and audio scene ranges.
 *
 * Timeline is normalized 0-1 across 1000vh of scroll.
 */

/* ── Scene boundaries ─────────────────────────────────────────── */

export const SCENES = {
  TITLE:    { start: 0.00, end: 0.06 },
  I:        { start: 0.06, end: 0.19, label: "I. THE SILENCE" },
  II:       { start: 0.21, end: 0.36, label: "II. THE PROLIFERATION" },
  III:      { start: 0.38, end: 0.53, label: "III. THE SEARCH" },
  IV:       { start: 0.55, end: 0.70, label: "IV. THE CONVERGENCE" },
  V:        { start: 0.72, end: 0.87, label: "V. THE SPARK" },
  OUTRO:    { start: 0.87, end: 1.00 },
} as const;

/* ── Transition zones (between scenes) ────────────────────────── */

export const TRANSITIONS = {
  I_II:     { start: 0.18, end: 0.22, at: 0.20 },
  II_III:   { start: 0.35, end: 0.39, at: 0.37 },
  III_IV:   { start: 0.52, end: 0.56, at: 0.54 },
  IV_V:     { start: 0.69, end: 0.73, at: 0.71 },
  V_OUTRO:  { start: 0.86, end: 0.90, at: 0.88 },
} as const;

/* ── Scene group mount/unmount windows (with overlap for crossfade) ─ */

export const SCENE_GROUPS = {
  EMBER:        { mount: 0.00, unmount: 0.24 },
  GROWTH:       { mount: 0.17, unmount: 0.41 },
  TESSELLATION: { mount: 0.33, unmount: 0.58 },
  HELIX:        { mount: 0.50, unmount: 0.76 },
  ATTRACTOR:    { mount: 0.67, unmount: Infinity },
} as const;

/* ── Text overlay windows ─────────────────────────────────────── */

export const TEXT = {
  TITLE:      { enterAt: 0.00, exitAt: 0.08, heroMode: true },
  I_INTRO:    { enterAt: 0.08, exitAt: 0.14 },
  I_QUOTE:    { enterAt: 0.12, exitAt: 0.19 },
  II_INTRO:   { enterAt: 0.22, exitAt: 0.28 },
  II_QUOTE:   { enterAt: 0.28, exitAt: 0.36 },
  III_INTRO:  { enterAt: 0.39, exitAt: 0.45 },
  III_QUOTE:  { enterAt: 0.45, exitAt: 0.53 },
  IV_INTRO:   { enterAt: 0.56, exitAt: 0.62 },
  IV_QUOTE:   { enterAt: 0.62, exitAt: 0.70 },
  V_INTRO:    { enterAt: 0.73, exitAt: 0.79 },
  V_QUOTE:    { enterAt: 0.79, exitAt: 0.87 },
  OUTRO:      { enterAt: 0.89, exitAt: 1.01 },
} as const;

/* ── Text fade timing ─────────────────────────────────────────── */

export const TEXT_FADE = {
  IN_DURATION: 0.05,
  OUT_DURATION: 0.03,
} as const;

/* ── Camera lerp speeds ───────────────────────────────────────── */

export const CAMERA_LERP = {
  TITLE: 0.03,
  SCENE: 0.10,
  TRANSITION: 0.08,
} as const;

/* ── Audio scene config ───────────────────────────────────────── */

export const AUDIO_SCENES = [
  { start: SCENES.I.start,   end: SCENES.I.end,   prefetchAt: 0 },
  { start: SCENES.II.start,  end: SCENES.II.end,  prefetchAt: 0.12 },
  { start: SCENES.III.start, end: SCENES.III.end,  prefetchAt: 0.28 },
  { start: SCENES.IV.start,  end: SCENES.IV.end,  prefetchAt: 0.45 },
  { start: SCENES.V.start,   end: SCENES.V.end,   prefetchAt: 0.62 },
] as const;

/* ── Scroll guide ─────────────────────────────────────────────── */

export const SCROLL_GUIDE = {
  ARROW_HIDE_AT: 0.10,
  GUIDE_HIDE_AT: 0.93,
} as const;

/* ── Helper: compute normalized scene progress (0-1 within a scene) ── */

export function sceneProgress(progress: number, sceneStart: number, sceneDuration: number): number {
  return Math.max(0, Math.min(1, (progress - sceneStart) / sceneDuration));
}

/* ── Helper: check if progress is in a transition zone ──────── */

export function isInTransition(progress: number): boolean {
  return Object.values(TRANSITIONS).some(
    t => progress >= t.start && progress <= t.end
  );
}
