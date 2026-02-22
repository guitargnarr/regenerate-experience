/**
 * Scene IV: The Convergence (0.54-0.69)
 * DNA Helix assembling. Two strands of scattered particles coalesce into spirals.
 * Gold strand = tools, green strand = outcomes.
 * Rungs connect between them, flashing at connection points.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const HELIX_RADIUS = 1.8;
const HELIX_HEIGHT = 10;
const HELIX_TURNS = 3;

export function HelixStrands({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const POINTS_PER_STRAND = isMobile ? 80 : 150;
  const meshRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  const { positions, colors, targetPositions, scatterPositions } = useMemo(() => {
    const total = POINTS_PER_STRAND * 2;
    const pos = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    const target = new Float32Array(total * 3);
    const scatter = new Float32Array(total * 3);

    for (let strand = 0; strand < 2; strand++) {
      const offset = strand * POINTS_PER_STRAND;
      const phaseOffset = strand * Math.PI;

      for (let i = 0; i < POINTS_PER_STRAND; i++) {
        const t = i / POINTS_PER_STRAND;
        const angle = t * Math.PI * 2 * HELIX_TURNS + phaseOffset;
        const y = (t - 0.5) * HELIX_HEIGHT;

        // Target helix position
        const tx = Math.cos(angle) * HELIX_RADIUS;
        const tz = Math.sin(angle) * HELIX_RADIUS;

        target[(offset + i) * 3] = tx;
        target[(offset + i) * 3 + 1] = y;
        target[(offset + i) * 3 + 2] = tz;

        // Scattered start position (wide sphere)
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.acos(2 * Math.random() - 1);
        const r = 3 + Math.random() * 4;
        scatter[(offset + i) * 3] = r * Math.sin(theta) * Math.cos(phi);
        scatter[(offset + i) * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
        scatter[(offset + i) * 3 + 2] = r * Math.cos(theta);

        // Start scattered
        pos[(offset + i) * 3] = scatter[(offset + i) * 3];
        pos[(offset + i) * 3 + 1] = scatter[(offset + i) * 3 + 1];
        pos[(offset + i) * 3 + 2] = scatter[(offset + i) * 3 + 2];

        // Gold strand vs moss strand
        if (strand === 0) {
          col[(offset + i) * 3] = 0.79;
          col[(offset + i) * 3 + 1] = 0.66;
          col[(offset + i) * 3 + 2] = 0.30;
        } else {
          col[(offset + i) * 3] = 0.29;
          col[(offset + i) * 3 + 1] = 0.49;
          col[(offset + i) * 3 + 2] = 0.35;
        }
      }
    }

    return { positions: pos, colors: col, targetPositions: target, scatterPositions: scatter };
  }, [POINTS_PER_STRAND]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.54) / 0.15));

    const posAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const total = POINTS_PER_STRAND * 2;

    // Coalesce from scatter to helix
    const coalesce = sceneP * sceneP * (3 - 2 * sceneP); // smoothstep

    for (let i = 0; i < total; i++) {
      const sx = scatterPositions[i * 3];
      const sy = scatterPositions[i * 3 + 1];
      const sz = scatterPositions[i * 3 + 2];
      const tx = targetPositions[i * 3];
      const ty = targetPositions[i * 3 + 1];
      const tz = targetPositions[i * 3 + 2];

      // Lerp scatter -> target with per-particle delay
      const particleDelay = (i % POINTS_PER_STRAND) / POINTS_PER_STRAND * 0.3;
      const localP = Math.max(0, Math.min(1, (coalesce - particleDelay) / (1 - particleDelay + 0.001)));

      arr[i * 3] = sx + (tx - sx) * localP;
      arr[i * 3 + 1] = sy + (ty - sy) * localP;
      arr[i * 3 + 2] = sz + (tz - sz) * localP;

      // Once coalesced, add gentle rotation
      if (localP > 0.9) {
        const rotAngle = t * 0.2;
        const x = arr[i * 3];
        const z = arr[i * 3 + 2];
        arr[i * 3] = x * Math.cos(rotAngle) - z * Math.sin(rotAngle);
        arr[i * 3 + 2] = x * Math.sin(rotAngle) + z * Math.cos(rotAngle);
      }
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={isMobile ? 0.08 : 0.06}
        vertexColors
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

export function HelixRungs({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const RUNG_COUNT = isMobile ? 15 : 25;
  const meshRef = useRef<THREE.LineSegments>(null);
  const flashRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  const { positions, flashPositions } = useMemo(() => {
    const pos = new Float32Array(RUNG_COUNT * 6);
    const flash = new Float32Array(RUNG_COUNT * 3);

    for (let i = 0; i < RUNG_COUNT; i++) {
      const t = (i + 0.5) / RUNG_COUNT;
      const angle = t * Math.PI * 2 * HELIX_TURNS;
      const y = (t - 0.5) * HELIX_HEIGHT;

      // Strand 1 point
      pos[i * 6] = Math.cos(angle) * HELIX_RADIUS;
      pos[i * 6 + 1] = y;
      pos[i * 6 + 2] = Math.sin(angle) * HELIX_RADIUS;

      // Strand 2 point (opposite side)
      pos[i * 6 + 3] = Math.cos(angle + Math.PI) * HELIX_RADIUS;
      pos[i * 6 + 4] = y;
      pos[i * 6 + 5] = Math.sin(angle + Math.PI) * HELIX_RADIUS;

      // Flash at midpoint
      flash[i * 3] = 0;
      flash[i * 3 + 1] = y;
      flash[i * 3 + 2] = 0;
    }

    return { positions: pos, flashPositions: flash };
  }, [RUNG_COUNT]);

  useFrame((_, delta) => {
    if (!meshRef.current || !flashRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.54) / 0.15));

    // Rungs appear after strands coalesce (latter 40% of scene)
    const rungPhase = Math.max(0, (sceneP - 0.5) / 0.5);

    const mat = meshRef.current.material as THREE.LineBasicMaterial;
    mat.opacity = rungPhase * 0.5;

    // Rotate with helix
    const rotAngle = t * 0.2;
    meshRef.current.rotation.y = rotAngle;
    flashRef.current.rotation.y = rotAngle;

    const flashMat = flashRef.current.material as THREE.PointsMaterial;
    flashMat.opacity = rungPhase * (0.3 + Math.sin(t * 3) * 0.3);
  });

  return (
    <>
      <lineSegments ref={meshRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color="#e4dcc8"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      <points ref={flashRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[flashPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={isMobile ? 0.15 : 0.12}
          color="#e2cc7a"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </>
  );
}

export function HelixLighting() {
  return (
    <>
      <ambientLight intensity={0.03} />
      <pointLight position={[0, 5, 3]} intensity={0.7} color="#c9a84c" distance={15} decay={2} />
      <pointLight position={[0, -5, 3]} intensity={0.5} color="#4a7c59" distance={15} decay={2} />
      <pointLight position={[3, 0, -2]} intensity={0.3} color="#e4dcc8" distance={10} decay={2} />
    </>
  );
}
