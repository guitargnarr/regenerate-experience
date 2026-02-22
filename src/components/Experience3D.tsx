/**
 * Experience3D: Main 3D canvas orchestrator -- 5-Scene Architecture
 * Regenera: A scroll-driven cinematic experience.
 * Timeline constants imported from @/constants/timeline.
 */

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EmberCore, DustMotes, GroundPlane, EmberLighting } from "./EmberScene";
import { TreeBranches, BranchParticles, LeafBuds, GrowthLighting, LeafParticles, GrowthBackdrop, generateTendrilPaths } from "./GrowthScene";
import { VoronoiCells, TessellationLighting } from "./TessellationScene";
import { HelixStrands, HelixRungs, HelixLighting, ConvergenceBackdrop } from "./HelixScene";
import { AttractorPath, SparkParticles, CentralStar, RadialRays, AttractorGlow, AttractorLighting, FinaleBackdrop } from "./AttractorScene";
import { PostEffects } from "./PostEffects";
import { HeroPlane } from "./HeroPlane";
import { SCENES, TRANSITIONS, SCENE_GROUPS, CAMERA_LERP, isInTransition } from "@/constants/timeline";

interface SceneProps {
  progress: number;
  isMobile?: boolean;
}

// Evaluate once at module load -- never re-runs on render
const hasWebGL = (() => {
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl");
    return gl instanceof WebGLRenderingContext || gl instanceof WebGL2RenderingContext;
  } catch { return false; }
})();

function GradientFallback({ progress }: { progress: number }) {
  const phase = progress * 5;
  return (
    <div className="fixed inset-0" style={{ zIndex: 0, background: "#0a0d08" }}>
      <div style={{ position: "absolute", left: "20%", top: "25%", width: "30%", height: "50%", background: "radial-gradient(ellipse, rgba(74,124,89,0.12) 0%, transparent 70%)", opacity: Math.max(0, 1 - phase), filter: "blur(40px)" }} />
      <div style={{ position: "absolute", right: "15%", top: "20%", width: "35%", height: "45%", background: "radial-gradient(ellipse, rgba(201,168,76,0.1) 0%, transparent 70%)", opacity: Math.min(1, phase * 0.3), filter: "blur(50px)" }} />
    </div>
  );
}

/* === MORPH CAMERA (uses SCENES constants) === */

function MorphCamera({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const { camera } = useThree();
  const currentPos = useRef(new THREE.Vector3(0, 0.5, 10));
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));

  const zPull = isMobile ? 2.0 : 0;
  const xScale = isMobile ? 0.5 : 1;

  // Pre-compute scene endpoint positions for seamless transitions
  const getScenePos = (scene: string, t: number): [THREE.Vector3, THREE.Vector3] => {
    switch (scene) {
      case 'TITLE': {
        const heroP = t;
        return [new THREE.Vector3(0, 0, 8 + zPull - heroP * 2), new THREE.Vector3(0, 0, 0)];
      }
      case 'I': {
        const angle = t * Math.PI * 0.3;
        return [new THREE.Vector3(Math.sin(angle) * 4 * xScale, 0.3 + t * 0.3, Math.cos(angle) * 4 + zPull), new THREE.Vector3(0, 0, 0)];
      }
      case 'II':
        return [new THREE.Vector3(Math.sin(t * Math.PI * 0.4) * 4 * xScale, 2 + t * 4, 8 + zPull), new THREE.Vector3(0, 2 + t * 3, 0)];
      case 'III': {
        const angle = t * Math.PI * 0.4;
        return [new THREE.Vector3(Math.sin(angle) * 2 * xScale, Math.sin(t * Math.PI) * 1, 10 + zPull), new THREE.Vector3(0, 0, 0)];
      }
      case 'IV': {
        const angle = t * Math.PI * 0.5;
        return [new THREE.Vector3(Math.sin(angle) * 14 * xScale, -1 + t * 3, Math.cos(angle) * 14 + zPull), new THREE.Vector3(0, 2, 0)];
      }
      case 'V': {
        const angle = t * Math.PI * 0.6;
        return [new THREE.Vector3(Math.sin(angle) * 7 * xScale, 1 + Math.sin(t * Math.PI * 0.5) * 2, Math.cos(angle) * 7 + zPull), new THREE.Vector3(0, 0, 0)];
      }
      default:
        return [new THREE.Vector3(0, 1, 8 + zPull), new THREE.Vector3(0, 0, 0)];
    }
  };

  useFrame(() => {
    let pos: THREE.Vector3;
    let lookAt: THREE.Vector3;

    const S = SCENES;
    const T = TRANSITIONS;

    if (progress < S.TITLE.end) {
      [pos, lookAt] = getScenePos('TITLE', progress / S.TITLE.end);
    } else if (progress < T.I_II.start) {
      const t = (progress - S.I.start) / (S.I.end - S.I.start);
      [pos, lookAt] = getScenePos('I', Math.min(t, 1));
    } else if (progress < T.I_II.end) {
      // Transition I->II: blend from Scene I end to Scene II start
      const t = (progress - T.I_II.start) / (T.I_II.end - T.I_II.start);
      const e = t * t * (3 - 2 * t);
      const [fromPos, fromLook] = getScenePos('I', 1);
      const [toPos, toLook] = getScenePos('II', 0);
      pos = fromPos.clone().lerp(toPos, e);
      lookAt = fromLook.clone().lerp(toLook, e);
    } else if (progress < T.II_III.start) {
      const t = (progress - S.II.start) / (S.II.end - S.II.start);
      [pos, lookAt] = getScenePos('II', Math.min(t, 1));
    } else if (progress < T.II_III.end) {
      // Transition II->III
      const t = (progress - T.II_III.start) / (T.II_III.end - T.II_III.start);
      const e = t * t * (3 - 2 * t);
      const [fromPos, fromLook] = getScenePos('II', 1);
      const [toPos, toLook] = getScenePos('III', 0);
      pos = fromPos.clone().lerp(toPos, e);
      lookAt = fromLook.clone().lerp(toLook, e);
    } else if (progress < T.III_IV.start) {
      const t = (progress - S.III.start) / (S.III.end - S.III.start);
      [pos, lookAt] = getScenePos('III', Math.min(t, 1));
    } else if (progress < T.III_IV.end) {
      // Transition III->IV
      const t = (progress - T.III_IV.start) / (T.III_IV.end - T.III_IV.start);
      const e = t * t * (3 - 2 * t);
      const [fromPos, fromLook] = getScenePos('III', 1);
      const [toPos, toLook] = getScenePos('IV', 0);
      pos = fromPos.clone().lerp(toPos, e);
      lookAt = fromLook.clone().lerp(toLook, e);
    } else if (progress < T.IV_V.start) {
      const t = (progress - S.IV.start) / (S.IV.end - S.IV.start);
      [pos, lookAt] = getScenePos('IV', Math.min(t, 1));
    } else if (progress < T.IV_V.end) {
      // Transition IV->V
      const t = (progress - T.IV_V.start) / (T.IV_V.end - T.IV_V.start);
      const e = t * t * (3 - 2 * t);
      const [fromPos, fromLook] = getScenePos('IV', 1);
      const [toPos, toLook] = getScenePos('V', 0);
      pos = fromPos.clone().lerp(toPos, e);
      lookAt = fromLook.clone().lerp(toLook, e);
    } else if (progress < S.V.end) {
      const t = (progress - S.V.start) / (S.V.end - S.V.start);
      [pos, lookAt] = getScenePos('V', Math.min(t, 1));
    } else {
      // Outro: drift upward from Scene V end
      const dur = S.OUTRO.end - S.OUTRO.start;
      const t = Math.min((progress - S.OUTRO.start) / dur, 1);
      const [fromPos] = getScenePos('V', 1);
      pos = new THREE.Vector3(
        fromPos.x + Math.sin(t * 0.3) * 2 * xScale,
        fromPos.y + t * 6,
        fromPos.z + t * 5
      );
      lookAt = new THREE.Vector3(0, -1, 0);
    }

    const lerpSpeed = progress < SCENES.TITLE.end ? CAMERA_LERP.TITLE
      : isInTransition(progress) ? CAMERA_LERP.TRANSITION
      : CAMERA_LERP.SCENE;
    currentPos.current.lerp(pos, lerpSpeed);
    currentLookAt.current.lerp(lookAt, lerpSpeed);
    camera.position.copy(currentPos.current);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}

/* === SCENE GROUPS === */

function EmberGroup({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const active = progress < SCENE_GROUPS.EMBER.unmount;
  if (!active) return null;
  return (
    <group>
      <EmberLighting />
      <EmberCore progress={progress} />
      <DustMotes progress={progress} isMobile={isMobile} />
      <GroundPlane progress={progress} />
    </group>
  );
}

function GrowthGroup({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const active = progress > SCENE_GROUPS.GROWTH.mount && progress < SCENE_GROUPS.GROWTH.unmount;

  const tipPositions = useMemo(() => {
    const pathCount = isMobile ? 18 : 36;
    const paths = generateTendrilPaths(pathCount);
    return paths.map(p => p.points[p.points.length - 1]);
  }, [isMobile]);

  if (!active) return null;
  return (
    <group scale={1.8}>
      <GrowthLighting />
      <TreeBranches progress={progress} isMobile={isMobile} />
      <BranchParticles progress={progress} isMobile={isMobile} />
      <LeafBuds progress={progress} isMobile={isMobile} tipPositions={tipPositions} />
      <LeafParticles progress={progress} isMobile={isMobile} />
      <GrowthBackdrop progress={progress} />
    </group>
  );
}

function TessellationGroup({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const active = progress > SCENE_GROUPS.TESSELLATION.mount && progress < SCENE_GROUPS.TESSELLATION.unmount;
  if (!active) return null;
  return (
    <group>
      <TessellationLighting />
      <VoronoiCells progress={progress} isMobile={isMobile} />
    </group>
  );
}

function HelixGroup({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const active = progress > SCENE_GROUPS.HELIX.mount && progress < SCENE_GROUPS.HELIX.unmount;
  if (!active) return null;
  return (
    <group>
      <HelixLighting />
      <HelixStrands progress={progress} isMobile={isMobile} />
      <HelixRungs progress={progress} isMobile={isMobile} />
      <ConvergenceBackdrop progress={progress} />
    </group>
  );
}

function AttractorGroup({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const active = progress > SCENE_GROUPS.ATTRACTOR.mount;
  if (!active) return null;
  return (
    <group>
      <AttractorLighting progress={progress} />
      <AttractorPath progress={progress} isMobile={isMobile} />
      <SparkParticles progress={progress} isMobile={isMobile} />
      <CentralStar progress={progress} />
      <RadialRays progress={progress} />
      <AttractorGlow progress={progress} />
      <FinaleBackdrop progress={progress} />
    </group>
  );
}

/* === AMBIENT PARTICLES === */

function AmbientParticles({ isMobile }: { isMobile: boolean }) {
  const count = isMobile ? 150 : 400;
  const meshRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  const { positions, basePositions } = useMemo(() => {
    const p = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 30;
      const y = (Math.random() - 0.5) * 20;
      const z = (Math.random() - 0.5) * 30;
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
      base[i * 3] = x; base[i * 3 + 1] = y; base[i * 3 + 2] = z;
    }
    return { positions: p, basePositions: base };
  }, [count]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const posAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3] = basePositions[i * 3] + Math.cos(t * 0.15 + i * 0.3) * 0.3;
      arr[i * 3 + 1] = basePositions[i * 3 + 1] + Math.sin(t * 0.2 + i * 0.5) * 0.5;
      arr[i * 3 + 2] = basePositions[i * 3 + 2] + Math.sin(t * 0.1 + i * 0.7) * 0.2;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#3a5440" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
    </points>
  );
}

/* === MAIN EXPORT === */

export default function Experience3D({ progress, isMobile = false }: SceneProps) {
  if (!hasWebGL) {
    return <GradientFallback progress={progress} />;
  }

  return (
    <div className="fixed inset-0" style={{ zIndex: 1, width: "100vw", height: "100dvh" }}>
      <Canvas
        camera={{ position: [0, 0.5, 10], fov: isMobile ? 65 : 50, near: 0.1, far: 100 }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        shadows={progress > SCENE_GROUPS.HELIX.mount && progress < SCENE_GROUPS.HELIX.unmount}
        gl={{ antialias: !isMobile, powerPreference: isMobile ? "low-power" : "default", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
        style={{ pointerEvents: "none" }}
      >
        <color attach="background" args={["#0a0d08"]} />
        <fog attach="fog" args={["#0a0d08", isMobile ? 14 : 12, isMobile ? 40 : 35]} />

        <MorphCamera progress={progress} isMobile={isMobile} />

        {/* Cinematic hero dissolve */}
        <HeroPlane progress={progress} />

        <EmberGroup progress={progress} isMobile={isMobile} />
        <GrowthGroup progress={progress} isMobile={isMobile} />
        <TessellationGroup progress={progress} isMobile={isMobile} />
        <HelixGroup progress={progress} isMobile={isMobile} />
        <AttractorGroup progress={progress} isMobile={isMobile} />

        <AmbientParticles isMobile={isMobile} />

        <PostEffects progress={progress} />
      </Canvas>
    </div>
  );
}
