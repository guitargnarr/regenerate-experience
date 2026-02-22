/**
 * useSceneAudio: Sample-based Web Audio engine for Regenera.
 *
 * Replaces procedural synthesis with real audio samples per scene.
 * Progressive loading: samples fetched as scroll approaches each scene.
 * Stochastic triggers: samples fire at semi-random intervals within scene.
 * Ambient bed: filtered brown noise for continuity between scenes.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { AUDIO_SCENES, SCENES as TL } from "@/constants/timeline";

/* ── Sample manifest ─────────────────────────────────────────────── */

interface SampleConfig {
  url: string;
  minInterval: number;
  maxInterval: number;
  gain: number;
}

interface SceneConfig {
  start: number;
  end: number;
  prefetchAt: number;
  samples: SampleConfig[];
}

const SCENES: SceneConfig[] = [
  {
    ...AUDIO_SCENES[0],
    samples: [
      { url: "/audio/breath.mp3", minInterval: 3, maxInterval: 6, gain: 0.5 },
      { url: "/audio/wind-distant.mp3", minInterval: 5, maxInterval: 9, gain: 0.35 },
    ],
  },
  {
    ...AUDIO_SCENES[1],
    samples: [
      { url: "/audio/wood-creak.mp3", minInterval: 3, maxInterval: 7, gain: 0.4 },
      { url: "/audio/leaves-rustle.mp3", minInterval: 2, maxInterval: 5, gain: 0.45 },
      { url: "/audio/twig-snap.mp3", minInterval: 4, maxInterval: 10, gain: 0.55 },
    ],
  },
  {
    ...AUDIO_SCENES[2],
    samples: [
      { url: "/audio/footstep.mp3", minInterval: 1.5, maxInterval: 4, gain: 0.45 },
      { url: "/audio/door-latch.mp3", minInterval: 4, maxInterval: 8, gain: 0.4 },
      { url: "/audio/radio-static.mp3", minInterval: 3, maxInterval: 7, gain: 0.3 },
    ],
  },
  {
    ...AUDIO_SCENES[3],
    samples: [
      { url: "/audio/click-lock.mp3", minInterval: 2, maxInterval: 5, gain: 0.5 },
      { url: "/audio/resonant-chime.mp3", minInterval: 4, maxInterval: 8, gain: 0.4 },
    ],
  },
  {
    ...AUDIO_SCENES[4],
    samples: [
      { url: "/audio/electric-spark.mp3", minInterval: 2, maxInterval: 5, gain: 0.5 },
      { url: "/audio/match-strike.mp3", minInterval: 5, maxInterval: 10, gain: 0.55 },
      { url: "/audio/fire-crackle.mp3", minInterval: 3, maxInterval: 7, gain: 0.4 },
    ],
  },
];

/* ── Hook ─────────────────────────────────────────────────────────── */

export function useSceneAudio(progress: number) {
  const [isPlaying, setIsPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const sceneGainsRef = useRef<GainNode[]>([]);
  const noiseRef = useRef<{ source: AudioBufferSourceNode; gain: GainNode } | null>(null);
  const reverbRef = useRef<ConvolverNode | null>(null);
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const fetchingRef = useRef<Set<string>>(new Set());
  const prefetchedScenesRef = useRef<Set<number>>(new Set());
  const lastTriggerRef = useRef<Map<string, number>>(new Map());
  const nextIntervalRef = useRef<Map<string, number>>(new Map());
  const rafRef = useRef<number | null>(null);
  const prevSceneRef = useRef<number>(-1);

  /* ── Fetch and decode a sample ─────────────────────────────────── */
  const loadSample = useCallback(async (url: string) => {
    if (bufferCacheRef.current.has(url) || fetchingRef.current.has(url)) return;
    fetchingRef.current.add(url);
    try {
      const res = await fetch(url);
      const arrayBuf = await res.arrayBuffer();
      const ctx = ctxRef.current;
      if (!ctx) return;
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      bufferCacheRef.current.set(url, audioBuf);
    } catch {
      // Silent fail -- sample just won't play
    } finally {
      fetchingRef.current.delete(url);
    }
  }, []);

  /* ── Prefetch all samples for a scene ──────────────────────────── */
  const prefetchScene = useCallback((sceneIdx: number) => {
    if (prefetchedScenesRef.current.has(sceneIdx)) return;
    prefetchedScenesRef.current.add(sceneIdx);
    for (const sample of SCENES[sceneIdx].samples) {
      loadSample(sample.url);
    }
  }, [loadSample]);

  /* ── Play a single sample ──────────────────────────────────────── */
  const playSample = useCallback((url: string, gain: number, sceneIdx: number) => {
    const ctx = ctxRef.current;
    const buffer = bufferCacheRef.current.get(url);
    if (!ctx || !buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const sampleGain = ctx.createGain();
    sampleGain.gain.value = gain;

    const sceneGain = sceneGainsRef.current[sceneIdx];
    if (!sceneGain) return;

    source.connect(sampleGain);
    sampleGain.connect(sceneGain);

    // Also send to reverb
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.25;
    sampleGain.connect(reverbSend);
    if (reverbRef.current) {
      reverbSend.connect(reverbRef.current);
    }

    source.start();
  }, []);

  /* ── Create audio graph ────────────────────────────────────────── */
  const createAudioGraph = useCallback(() => {
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    // Master gain
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    // Reverb (procedural impulse response)
    const reverbLen = ctx.sampleRate * 2;
    const reverbBuf = ctx.createBuffer(2, reverbLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = reverbBuf.getChannelData(ch);
      for (let i = 0; i < reverbLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.8));
      }
    }
    const reverb = ctx.createConvolver();
    reverb.buffer = reverbBuf;
    reverbRef.current = reverb;

    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.3;
    reverb.connect(reverbGain);
    reverbGain.connect(masterGain);

    // Per-scene gain nodes (for crossfading)
    const gains: GainNode[] = [];
    for (let i = 0; i < SCENES.length; i++) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(masterGain);
      gains.push(g);
    }
    sceneGainsRef.current = gains;

    // Ambient noise bed (filtered brown noise, very low)
    const bufferSize = ctx.sampleRate * 4;
    const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      data[i] = lastOut * 3.5;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuf;
    noiseSource.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 300;
    noiseFilter.Q.value = 1;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.06;

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noiseSource.start();

    noiseRef.current = { source: noiseSource, gain: noiseGain };

    // Prefetch scene I immediately
    prefetchScene(0);
  }, [prefetchScene]);

  /* ── Determine active scene index from progress ────────────────── */
  const getActiveScene = useCallback((p: number): number => {
    for (let i = 0; i < SCENES.length; i++) {
      if (p >= SCENES[i].start && p <= SCENES[i].end) return i;
    }
    // In transition zone -- find nearest scene
    for (let i = 0; i < SCENES.length - 1; i++) {
      if (p > SCENES[i].end && p < SCENES[i + 1].start) {
        const mid = (SCENES[i].end + SCENES[i + 1].start) / 2;
        return p < mid ? i : i + 1;
      }
    }
    if (p < SCENES[0].start) return 0;
    return SCENES.length - 1;
  }, []);

  /* ── Update loop: crossfade gains + trigger samples ────────────── */
  useEffect(() => {
    if (!isPlaying || !ctxRef.current) return;

    const ctx = ctxRef.current;

    const update = () => {
      const now = ctx.currentTime;

      const activeScene = getActiveScene(progress);

      // Crossfade scene gains -- only update active scene and neighbors
      for (let i = 0; i < SCENES.length; i++) {
        const g = sceneGainsRef.current[i];
        if (!g) continue;
        const isNear = Math.abs(i - activeScene) <= 1;
        if (!isNear && g.gain.value < 0.01) continue; // skip distant silent scenes
        const target = i === activeScene ? 1 : 0;
        g.gain.setTargetAtTime(target, now, 0.5);
      }

      // Track scene change for initial trigger timing
      if (activeScene !== prevSceneRef.current) {
        prevSceneRef.current = activeScene;
      }

      // Prefetch upcoming scenes
      for (let i = 0; i < SCENES.length; i++) {
        if (progress >= SCENES[i].prefetchAt) {
          prefetchScene(i);
        }
      }

      // Stochastic sample triggers for active scene
      const scene = SCENES[activeScene];
      if (progress >= scene.start && progress <= scene.end) {
        for (const sample of scene.samples) {
          const lastTrigger = lastTriggerRef.current.get(sample.url) ?? 0;
          const elapsed = now - lastTrigger;

          // Get or compute next interval
          let nextInterval = nextIntervalRef.current.get(sample.url);
          if (nextInterval === undefined) {
            nextInterval = sample.minInterval + Math.random() * (sample.maxInterval - sample.minInterval);
            nextIntervalRef.current.set(sample.url, nextInterval);
          }

          if (elapsed >= nextInterval) {
            playSample(sample.url, sample.gain, activeScene);
            lastTriggerRef.current.set(sample.url, now);
            // Compute next random interval
            nextIntervalRef.current.set(
              sample.url,
              sample.minInterval + Math.random() * (sample.maxInterval - sample.minInterval)
            );
          }
        }
      }

      // Fade out noise after last scene
      if (noiseRef.current) {
        const outroStart = TL.OUTRO.start;
        const noiseTarget = progress > outroStart ? Math.max(0, 0.06 * (1 - (progress - outroStart) / (1 - outroStart))) : 0.06;
        noiseRef.current.gain.gain.setTargetAtTime(noiseTarget, now, 0.3);
      }

      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, progress, getActiveScene, playSample, prefetchScene]);

  /* ── Toggle ────────────────────────────────────────────────────── */
  const toggleAudio = useCallback(() => {
    if (isPlaying) {
      if (masterGainRef.current && ctxRef.current) {
        masterGainRef.current.gain.setTargetAtTime(0, ctxRef.current.currentTime, 0.3);
        setTimeout(() => {
          ctxRef.current?.suspend();
        }, 500);
      }
      setIsPlaying(false);
    } else {
      if (!ctxRef.current) {
        createAudioGraph();
      } else {
        ctxRef.current.resume();
        if (masterGainRef.current) {
          masterGainRef.current.gain.setTargetAtTime(0.7, ctxRef.current.currentTime, 0.3);
        }
      }
      setIsPlaying(true);
    }
  }, [isPlaying, createAudioGraph]);

  /* ── Cleanup ───────────────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      ctxRef.current?.close();
    };
  }, []);

  return { isPlaying, toggleAudio };
}
