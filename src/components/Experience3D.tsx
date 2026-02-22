/**
 * Experience3D: Main 3D canvas orchestrator -- 5-Scene Architecture
 * Regenerate: The story of what was already happening.
 *
 * Timeline (normalized 0-1):
 *   0.00-0.03  Title
 *   0.03-0.18  I.   The Silence (buried seed)
 *   0.18-0.20  Transition I->II
 *   0.20-0.35  II.  The Proliferation (erupting growth)
 *   0.35-0.37  Transition II->III
 *   0.37-0.52  III. The Search (shifting polyhedra)
 *   0.52-0.54  Transition III->IV
 *   0.54-0.69  IV.  The Convergence (assembling architecture)
 *   0.69-0.71  Transition IV->V
 *   0.71-0.86  V.   The Spark (ignition bloom)
 *   0.86-1.00  Outro
 */

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EmberCore, DustMotes, GroundPlane, EmberLighting } from "./EmberScene";
import { TreeBranches, BranchParticles, LeafBuds, GrowthLighting } from "./GrowthScene";
import { VoronoiCells, TessellationLighting } from "./TessellationScene";
import { HelixStrands, HelixRungs, HelixLighting } from "./HelixScene";
import { AttractorPath, SparkParticles, CentralStar, RadialRays, AttractorGlow, AttractorLighting } from "./AttractorScene";
import { PostEffects } from "./PostEffects";

interface SceneProps {
  progress: number;
  isMobile?: boolean;
}

function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl");
    return gl instanceof WebGLRenderingContext || gl instanceof WebGL2RenderingContext;
  } catch { return false; }
}

function GradientFallback({ progress }: { progress: number }) {
  const phase = progress * 5;
  return (
    <div className="fixed inset-0" style={{ zIndex: 0, background: "#0a0d08" }}>
      <div style={{ position: "absolute", left: "20%", top: "25%", width: "30%", height: "50%", background: "radial-gradient(ellipse, rgba(74,124,89,0.12) 0%, transparent 70%)", opacity: Math.max(0, 1 - phase), filter: "blur(40px)" }} />
      <div style={{ position: "absolute", right: "15%", top: "20%", width: "35%", height: "45%", background: "radial-gradient(ellipse, rgba(201,168,76,0.1) 0%, transparent 70%)", opacity: Math.min(1, phase * 0.3), filter: "blur(50px)" }} />
    </div>
  );
}

/* === MORPH CAMERA === */

function MorphCamera({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const { camera } = useThree();
  const currentPos = useRef(new THREE.Vector3(0, 0.5, 10));
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));

  const zPull = isMobile ? 2.0 : 0;
  const xScale = isMobile ? 0.5 : 1;

  useFrame(() => {
    let pos: THREE.Vector3;
    let lookAt: THREE.Vector3;

    if (progress < 0.03) {
      pos = new THREE.Vector3(0, 0, 8 + zPull);
      lookAt = new THREE.Vector3(0, 0, 0);
    } else if (progress < 0.18) {
      // Scene I: close orbit around seed
      const t = (progress - 0.03) / 0.15;
      const angle = t * Math.PI * 0.3;
      pos = new THREE.Vector3(Math.sin(angle) * 4 * xScale, 0.3 + t * 0.3, Math.cos(angle) * 4 + zPull);
      lookAt = new THREE.Vector3(0, 0, 0);
    } else if (progress < 0.20) {
      // Transition I->II: pull back to see growth
      const t = (progress - 0.18) / 0.02;
      const e = t * t * (3 - 2 * t);
      pos = new THREE.Vector3(e * 2 * xScale, 0.5 * (1 - e) + 2 * e, 4 * (1 - e) + 8 * e + zPull);
      lookAt = new THREE.Vector3(0, e * 2, 0);
    } else if (progress < 0.35) {
      // Scene II: medium distance, centered on tendril mass, rising with growth
      const t = (progress - 0.20) / 0.15;
      pos = new THREE.Vector3(Math.sin(t * Math.PI * 0.4) * 4 * xScale, 2 + t * 4, 8 + zPull);
      lookAt = new THREE.Vector3(0, 2 + t * 3, 0);
    } else if (progress < 0.37) {
      // Transition II->III
      const t = (progress - 0.35) / 0.02;
      const e = t * t * (3 - 2 * t);
      pos = new THREE.Vector3(2 * (1 - e) * xScale, 6 * (1 - e) + 1 * e, 8 * (1 - e) + 10 * e + zPull);
      lookAt = new THREE.Vector3(0, 5 * (1 - e), 0);
    } else if (progress < 0.52) {
      // Scene III: face-on, slight orbit
      const t = (progress - 0.37) / 0.15;
      const angle = t * Math.PI * 0.4;
      pos = new THREE.Vector3(Math.sin(angle) * 2 * xScale, Math.sin(t * Math.PI) * 1, 10 + zPull);
      lookAt = new THREE.Vector3(0, 0, 0);
    } else if (progress < 0.54) {
      // Transition III->IV: sweep to low angle for helix
      const t = (progress - 0.52) / 0.02;
      const e = t * t * (3 - 2 * t);
      pos = new THREE.Vector3(e * 5 * xScale, 1 * (1 - e) + (-1) * e, 10 * (1 - e) + 14 * e + zPull);
      lookAt = new THREE.Vector3(0, e * 1, 0);
    } else if (progress < 0.69) {
      // Scene IV: wide orbit, looking at assembling helix (radius 14, eye-level)
      const t = (progress - 0.54) / 0.15;
      const angle = t * Math.PI * 0.5;
      pos = new THREE.Vector3(Math.sin(angle) * 14 * xScale, -1 + t * 3, Math.cos(angle) * 14 + zPull);
      lookAt = new THREE.Vector3(0, 2, 0);
    } else if (progress < 0.71) {
      // Transition IV->V
      const t = (progress - 0.69) / 0.02;
      const e = t * t * (3 - 2 * t);
      pos = new THREE.Vector3(6 * (1 - e) * xScale, 2 * (1 - e) + 1 * e, 14 * (1 - e) + 8 * e + zPull);
      lookAt = new THREE.Vector3(0, 2 * (1 - e), 0);
    } else if (progress < 0.86) {
      // Scene V: orbit the attractor
      const t = (progress - 0.71) / 0.15;
      const angle = t * Math.PI * 0.6;
      pos = new THREE.Vector3(Math.sin(angle) * 7 * xScale, 1 + Math.sin(t * Math.PI * 0.5) * 2, Math.cos(angle) * 7 + zPull);
      lookAt = new THREE.Vector3(0, 0, 0);
    } else {
      const t = (progress - 0.86) / 0.14;
      pos = new THREE.Vector3(Math.sin(t * 0.3) * 2 * xScale, 1 + t * 6, 8 + t * 5 + zPull);
      lookAt = new THREE.Vector3(0, -1, 0);
    }

    const lerpSpeed = progress < 0.03 ? 0.015 : 0.06;
    currentPos.current.lerp(pos, lerpSpeed);
    currentLookAt.current.lerp(lookAt, lerpSpeed);
    camera.position.copy(currentPos.current);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}

/* === SCENE GROUPS === */

function EmberGroup({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const active = progress < 0.21;
  if (!active) return null;
  return (
    <group>
      <EmberLighting />
      <EmberCore progress={progress} />
      <DustMotes progress={progress} isMobile={isMobile} />
      <GroundPlane />
    </group>
  );
}

function GrowthGroup({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const active = progress > 0.18 && progress < 0.38;
  if (!active) return null;
  return (
    <group scale={1.8}>
      <GrowthLighting />
      <TreeBranches progress={progress} isMobile={isMobile} />
      <BranchParticles progress={progress} isMobile={isMobile} />
      <LeafBuds progress={progress} isMobile={isMobile} />
    </group>
  );
}

function TessellationGroup({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const active = progress > 0.33 && progress < 0.55;
  if (!active) return null;
  return (
    <group>
      <TessellationLighting />
      <VoronoiCells progress={progress} isMobile={isMobile} />
    </group>
  );
}

function HelixGroup({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const active = progress > 0.50 && progress < 0.75;
  if (!active) return null;
  return (
    <group>
      <HelixLighting />
      <HelixStrands progress={progress} isMobile={isMobile} />
      <HelixRungs progress={progress} isMobile={isMobile} />
    </group>
  );
}

function AttractorGroup({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const active = progress > 0.67;
  if (!active) return null;
  return (
    <group>
      <AttractorLighting progress={progress} />
      <AttractorPath progress={progress} isMobile={isMobile} />
      <SparkParticles progress={progress} isMobile={isMobile} />
      <CentralStar progress={progress} />
      <RadialRays progress={progress} />
      <AttractorGlow progress={progress} />
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
  if (typeof window !== "undefined" && !detectWebGL()) {
    return <GradientFallback progress={progress} />;
  }

  return (
    <div className="fixed inset-0" style={{ zIndex: 1, width: "100vw", height: "100dvh" }}>
      <Canvas
        camera={{ position: [0, 0.5, 10], fov: isMobile ? 65 : 50, near: 0.1, far: 100 }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        shadows={progress > 0.50 && progress < 0.75}
        gl={{ antialias: !isMobile, powerPreference: isMobile ? "low-power" : "default", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
        style={{ pointerEvents: "none" }}
      >
        <color attach="background" args={["#0a0d08"]} />
        <fog attach="fog" args={["#0a0d08", isMobile ? 14 : 12, isMobile ? 40 : 35]} />

        <MorphCamera progress={progress} isMobile={isMobile} />

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
