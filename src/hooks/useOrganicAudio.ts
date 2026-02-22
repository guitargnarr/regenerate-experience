/**
 * useOrganicAudio: Procedural Web Audio synthesis for Regenerate.
 *
 * 5 scene configurations:
 *   I.  The Silence    -- near-silence, faint low drone
 *   II. The Proliferation -- organic crackle, wood-tone FM chimes
 *   III. The Search    -- restless mid-range hum, shifting filters
 *   IV. The Convergence -- warm dual-tone, resolving harmonics
 *   V.  The Spark      -- full spectrum, bright FM shimmer
 */

import { useState, useRef, useCallback, useEffect } from "react";

interface SceneAudioConfig {
  droneFreq: number;
  droneGain: number;
  filterFreq: number;
  filterQ: number;
  chimeRate: number;    // chimes per second
  chimeFreqBase: number;
  chimeGain: number;
  lfoRate: number;
  lfoDepth: number;
}

const SCENE_CONFIGS: SceneAudioConfig[] = [
  // I. The Silence
  { droneFreq: 55, droneGain: 0.02, filterFreq: 200, filterQ: 2, chimeRate: 0, chimeFreqBase: 220, chimeGain: 0, lfoRate: 0.1, lfoDepth: 5 },
  // II. The Proliferation
  { droneFreq: 82, droneGain: 0.04, filterFreq: 400, filterQ: 3, chimeRate: 0.8, chimeFreqBase: 330, chimeGain: 0.03, lfoRate: 0.25, lfoDepth: 15 },
  // III. The Search
  { droneFreq: 73, droneGain: 0.05, filterFreq: 600, filterQ: 4, chimeRate: 1.2, chimeFreqBase: 440, chimeGain: 0.025, lfoRate: 0.4, lfoDepth: 30 },
  // IV. The Convergence
  { droneFreq: 110, droneGain: 0.06, filterFreq: 800, filterQ: 2.5, chimeRate: 1.5, chimeFreqBase: 550, chimeGain: 0.035, lfoRate: 0.15, lfoDepth: 10 },
  // V. The Spark
  { droneFreq: 130, droneGain: 0.07, filterFreq: 1200, filterQ: 2, chimeRate: 2.0, chimeFreqBase: 660, chimeGain: 0.04, lfoRate: 0.3, lfoDepth: 20 },
];

function lerpConfig(a: SceneAudioConfig, b: SceneAudioConfig, t: number): SceneAudioConfig {
  const l = (x: number, y: number) => x + (y - x) * t;
  return {
    droneFreq: l(a.droneFreq, b.droneFreq),
    droneGain: l(a.droneGain, b.droneGain),
    filterFreq: l(a.filterFreq, b.filterFreq),
    filterQ: l(a.filterQ, b.filterQ),
    chimeRate: l(a.chimeRate, b.chimeRate),
    chimeFreqBase: l(a.chimeFreqBase, b.chimeFreqBase),
    chimeGain: l(a.chimeGain, b.chimeGain),
    lfoRate: l(a.lfoRate, b.lfoRate),
    lfoDepth: l(a.lfoDepth, b.lfoDepth),
  };
}

function getConfigForProgress(progress: number): SceneAudioConfig {
  const scenes = [
    { start: 0.03, end: 0.18, idx: 0 },
    { start: 0.20, end: 0.35, idx: 1 },
    { start: 0.37, end: 0.52, idx: 2 },
    { start: 0.54, end: 0.69, idx: 3 },
    { start: 0.71, end: 0.86, idx: 4 },
  ];

  // Before first scene
  if (progress < 0.03) return { ...SCENE_CONFIGS[0], droneGain: SCENE_CONFIGS[0].droneGain * progress / 0.03 };

  // After last scene
  if (progress > 0.86) {
    const fadeOut = Math.max(0, 1 - (progress - 0.86) / 0.14);
    const cfg = { ...SCENE_CONFIGS[4] };
    cfg.droneGain *= fadeOut;
    cfg.chimeGain *= fadeOut;
    return cfg;
  }

  // In a scene
  for (const scene of scenes) {
    if (progress >= scene.start && progress <= scene.end) {
      return SCENE_CONFIGS[scene.idx];
    }
  }

  // In a transition
  for (let i = 0; i < scenes.length - 1; i++) {
    const from = scenes[i];
    const to = scenes[i + 1];
    if (progress > from.end && progress < to.start) {
      const t = (progress - from.end) / (to.start - from.end);
      return lerpConfig(SCENE_CONFIGS[from.idx], SCENE_CONFIGS[to.idx], t);
    }
  }

  return SCENE_CONFIGS[0];
}

export function useOrganicAudio(progress: number) {
  const [isPlaying, setIsPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{
    noise: AudioBufferSourceNode;
    droneOsc: OscillatorNode;
    lfo: OscillatorNode;
    lfoGain: GainNode;
    droneGain: GainNode;
    filter: BiquadFilterNode;
    masterGain: GainNode;
  } | null>(null);
  const chimeTimerRef = useRef<number>(0);
  const lastChimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const createAudioGraph = useCallback(() => {
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    // Noise buffer for texture
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.008;

    // Drone oscillator
    const droneOsc = ctx.createOscillator();
    droneOsc.type = "sine";
    droneOsc.frequency.value = 55;

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.02;

    // LFO
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.1;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 5;

    // Filter
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 200;
    filter.Q.value = 2;

    // Reverb (convolver)
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

    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.3;

    // Master gain
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.6;

    // Routing
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    noise.connect(noiseGain);
    noiseGain.connect(filter);

    droneOsc.connect(droneGain);
    droneGain.connect(filter);

    filter.connect(masterGain);
    filter.connect(reverb);
    reverb.connect(reverbGain);
    reverbGain.connect(masterGain);

    masterGain.connect(ctx.destination);

    noise.start();
    droneOsc.start();
    lfo.start();

    nodesRef.current = { noise, droneOsc, lfo, lfoGain, droneGain, filter, masterGain };
  }, []);

  const scheduleChime = useCallback((config: SceneAudioConfig) => {
    const ctx = ctxRef.current;
    if (!ctx || config.chimeGain <= 0) return;

    const now = ctx.currentTime;

    // FM synthesis chime
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    const envelope = ctx.createGain();

    const freq = config.chimeFreqBase * (0.8 + Math.random() * 0.4);
    carrier.type = "sine";
    carrier.frequency.value = freq;

    modulator.type = "sine";
    modulator.frequency.value = freq * (1.5 + Math.random() * 2);
    modGain.gain.value = freq * 0.3;

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(config.chimeGain, now + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    carrier.connect(envelope);
    envelope.connect(ctxRef.current!.destination);

    carrier.start(now);
    modulator.start(now);
    carrier.stop(now + 2);
    modulator.stop(now + 2);
  }, []);

  // Update loop
  useEffect(() => {
    if (!isPlaying || !nodesRef.current) return;

    const update = () => {
      const config = getConfigForProgress(progress);
      const nodes = nodesRef.current;
      if (!nodes) return;

      const ctx = ctxRef.current;
      if (!ctx) return;

      const now = ctx.currentTime;
      const smoothTime = 0.1;

      nodes.droneOsc.frequency.setTargetAtTime(config.droneFreq, now, smoothTime);
      nodes.droneGain.gain.setTargetAtTime(config.droneGain, now, smoothTime);
      nodes.filter.frequency.setTargetAtTime(config.filterFreq, now, smoothTime);
      nodes.filter.Q.setTargetAtTime(config.filterQ, now, smoothTime);
      nodes.lfo.frequency.setTargetAtTime(config.lfoRate, now, smoothTime);
      nodes.lfoGain.gain.setTargetAtTime(config.lfoDepth, now, smoothTime);

      // Stochastic chime scheduling
      chimeTimerRef.current += 1 / 60;
      if (config.chimeRate > 0) {
        const interval = 1 / config.chimeRate;
        if (chimeTimerRef.current - lastChimeRef.current > interval * (0.5 + Math.random())) {
          scheduleChime(config);
          lastChimeRef.current = chimeTimerRef.current;
        }
      }

      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, progress, scheduleChime]);

  const toggleAudio = useCallback(() => {
    if (isPlaying) {
      if (nodesRef.current) {
        nodesRef.current.masterGain.gain.setTargetAtTime(0, ctxRef.current!.currentTime, 0.3);
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
        if (nodesRef.current) {
          nodesRef.current.masterGain.gain.setTargetAtTime(0.6, ctxRef.current.currentTime, 0.3);
        }
      }
      setIsPlaying(true);
    }
  }, [isPlaying, createAudioGraph]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      ctxRef.current?.close();
    };
  }, []);

  return { isPlaying, toggleAudio };
}
