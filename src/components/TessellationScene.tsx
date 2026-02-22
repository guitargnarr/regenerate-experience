/**
 * Scene III: The Search (0.37-0.52)
 * Voronoi-inspired tessellation. Seed points appear, cell boundaries form.
 * Seeds drift, boundaries morph -- identity in flux. Stabilizes into coherence.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Seed {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export function VoronoiCells({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const SEED_COUNT = isMobile ? 12 : 20;
  const BOUNDARY_SAMPLES = isMobile ? 1200 : 2400;
  const meshRef = useRef<THREE.Points>(null);
  const seedRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  const { seeds, boundaryPositions, boundaryColors, seedPositions, seedColors } = useMemo(() => {
    const s: Seed[] = [];
    for (let i = 0; i < SEED_COUNT; i++) {
      s.push({
        x: (Math.random() - 0.5) * 8,
        y: (Math.random() - 0.5) * 6,
        z: (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        vz: (Math.random() - 0.5) * 0.15,
      });
    }

    const bPos = new Float32Array(BOUNDARY_SAMPLES * 3);
    const bCol = new Float32Array(BOUNDARY_SAMPLES * 3);
    const sPos = new Float32Array(SEED_COUNT * 3);
    const sCol = new Float32Array(SEED_COUNT * 3);

    for (let i = 0; i < SEED_COUNT; i++) {
      sPos[i * 3] = s[i].x;
      sPos[i * 3 + 1] = s[i].y;
      sPos[i * 3 + 2] = s[i].z;
      sCol[i * 3] = 0.85;
      sCol[i * 3 + 1] = 0.72;
      sCol[i * 3 + 2] = 0.35;
    }

    for (let i = 0; i < BOUNDARY_SAMPLES; i++) {
      bPos[i * 3] = (Math.random() - 0.5) * 10;
      bPos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      bPos[i * 3 + 2] = (Math.random() - 0.5) * 5;
      bCol[i * 3] = 0.43 + Math.random() * 0.2;
      bCol[i * 3 + 1] = 0.65 + Math.random() * 0.15;
      bCol[i * 3 + 2] = 0.45 + Math.random() * 0.15;
    }

    return { seeds: s, boundaryPositions: bPos, boundaryColors: bCol, seedPositions: sPos, seedColors: sCol };
  }, [SEED_COUNT, BOUNDARY_SAMPLES]);

  useFrame((_, delta) => {
    if (!meshRef.current || !seedRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.37) / 0.15));

    const stability = sceneP * sceneP;
    const driftScale = 1.0 - stability * 0.85;

    for (let i = 0; i < SEED_COUNT; i++) {
      seeds[i].x += seeds[i].vx * delta * driftScale;
      seeds[i].y += seeds[i].vy * delta * driftScale;
      seeds[i].z += seeds[i].vz * delta * driftScale;

      if (Math.abs(seeds[i].x) > 4) seeds[i].vx *= -0.8;
      if (Math.abs(seeds[i].y) > 3) seeds[i].vy *= -0.8;
      if (Math.abs(seeds[i].z) > 2) seeds[i].vz *= -0.8;

      seeds[i].x += Math.sin(t * 0.3 + i * 2.1) * 0.005 * driftScale;
      seeds[i].y += Math.cos(t * 0.25 + i * 1.7) * 0.005 * driftScale;
    }

    const sArr = (seedRef.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < SEED_COUNT; i++) {
      sArr[i * 3] = seeds[i].x;
      sArr[i * 3 + 1] = seeds[i].y;
      sArr[i * 3 + 2] = seeds[i].z;
    }
    (seedRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    const posAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const colAttr = meshRef.current.geometry.attributes.color as THREE.BufferAttribute;
    const cArr = colAttr.array as Float32Array;

    let bIdx = 0;
    const gridRes = isMobile ? 24 : 34;

    for (let gx = 0; gx < gridRes && bIdx < BOUNDARY_SAMPLES; gx++) {
      for (let gy = 0; gy < gridRes && bIdx < BOUNDARY_SAMPLES; gy++) {
        const px = (gx / gridRes - 0.5) * 10;
        const py = (gy / gridRes - 0.5) * 8;
        const pz = Math.sin(gx * 0.5 + gy * 0.3 + t * 0.2) * 0.5;

        let d1 = Infinity, d2 = Infinity;
        let _c1 = 0;
        for (let s = 0; s < SEED_COUNT; s++) {
          const dx = px - seeds[s].x;
          const dy = py - seeds[s].y;
          const d = dx * dx + dy * dy;
          if (d < d1) { d2 = d1; d1 = d; _c1 = s; }
          else if (d < d2) { d2 = d; }
        }

        const ratio = d1 / (d2 + 0.001);
        if (ratio > 0.65) {
          arr[bIdx * 3] = px;
          arr[bIdx * 3 + 1] = py;
          arr[bIdx * 3 + 2] = pz;

          const edgeIntensity = (ratio - 0.65) / 0.35;
          cArr[bIdx * 3] = 0.43 + edgeIntensity * 0.2 + _c1 * 0.01;
          cArr[bIdx * 3 + 1] = 0.65 + edgeIntensity * 0.15;
          cArr[bIdx * 3 + 2] = 0.45 + edgeIntensity * 0.12;

          bIdx++;
        }
      }
    }

    for (let i = bIdx; i < BOUNDARY_SAMPLES; i++) {
      arr[i * 3 + 1] = -100;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    const mat = meshRef.current.material as THREE.PointsMaterial;
    mat.opacity = sceneP * 0.85;

    const sMat = seedRef.current.material as THREE.PointsMaterial;
    sMat.opacity = sceneP * 0.95;
  });

  return (
    <>
      <points ref={meshRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[boundaryPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[boundaryColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={isMobile ? 0.08 : 0.06}
          vertexColors
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      <points ref={seedRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[seedPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[seedColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={isMobile ? 0.30 : 0.22}
          vertexColors
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

export function TessellationLighting() {
  return (
    <>
      <ambientLight intensity={0.06} />
      <pointLight position={[0, 0, 5]} intensity={1.2} color="#4a7c59" distance={18} decay={2} />
      <pointLight position={[-4, 3, 0]} intensity={0.6} color="#c9a84c" distance={14} decay={2} />
      <pointLight position={[3, -2, 2]} intensity={0.4} color="#6ea87e" distance={12} decay={2} />
    </>
  );
}
