/**
 * Scene III: The Search (0.37-0.52)
 * Voronoi-inspired tessellation. Seed points appear, cell boundaries form around them.
 * Seeds drift, boundaries morph in real time -- identity in flux.
 * Eventually stabilizes into a coherent pattern.
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
  const BOUNDARY_SAMPLES = isMobile ? 800 : 1600;
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

    // Initialize seed display positions
    for (let i = 0; i < SEED_COUNT; i++) {
      sPos[i * 3] = s[i].x;
      sPos[i * 3 + 1] = s[i].y;
      sPos[i * 3 + 2] = s[i].z;
      // Gold seeds
      sCol[i * 3] = 0.79;
      sCol[i * 3 + 1] = 0.66;
      sCol[i * 3 + 2] = 0.30;
    }

    // Initialize boundary positions scattered
    for (let i = 0; i < BOUNDARY_SAMPLES; i++) {
      bPos[i * 3] = (Math.random() - 0.5) * 10;
      bPos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      bPos[i * 3 + 2] = (Math.random() - 0.5) * 5;
      // Moss-colored boundaries
      bCol[i * 3] = 0.29 + Math.random() * 0.15;
      bCol[i * 3 + 1] = 0.49 + Math.random() * 0.1;
      bCol[i * 3 + 2] = 0.35 + Math.random() * 0.1;
    }

    return { seeds: s, boundaryPositions: bPos, boundaryColors: bCol, seedPositions: sPos, seedColors: sCol };
  }, [SEED_COUNT, BOUNDARY_SAMPLES]);

  useFrame((_, delta) => {
    if (!meshRef.current || !seedRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.37) / 0.15));

    // Stabilization factor: starts restless, settles
    const stability = sceneP * sceneP; // quadratic ease toward stable
    const driftScale = 1.0 - stability * 0.85;

    // Update seed positions
    for (let i = 0; i < SEED_COUNT; i++) {
      seeds[i].x += seeds[i].vx * delta * driftScale;
      seeds[i].y += seeds[i].vy * delta * driftScale;
      seeds[i].z += seeds[i].vz * delta * driftScale;

      // Soft boundaries
      if (Math.abs(seeds[i].x) > 4) seeds[i].vx *= -0.8;
      if (Math.abs(seeds[i].y) > 3) seeds[i].vy *= -0.8;
      if (Math.abs(seeds[i].z) > 2) seeds[i].vz *= -0.8;

      // Gentle organic motion
      seeds[i].x += Math.sin(t * 0.3 + i * 2.1) * 0.005 * driftScale;
      seeds[i].y += Math.cos(t * 0.25 + i * 1.7) * 0.005 * driftScale;
    }

    // Update seed display
    const sArr = (seedRef.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < SEED_COUNT; i++) {
      sArr[i * 3] = seeds[i].x;
      sArr[i * 3 + 1] = seeds[i].y;
      sArr[i * 3 + 2] = seeds[i].z;
    }
    (seedRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    // Compute Voronoi boundaries via distance field sampling
    const posAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const colAttr = meshRef.current.geometry.attributes.color as THREE.BufferAttribute;
    const cArr = colAttr.array as Float32Array;

    let bIdx = 0;
    const gridRes = isMobile ? 20 : 28;
    const reveal = sceneP;

    for (let gx = 0; gx < gridRes && bIdx < BOUNDARY_SAMPLES; gx++) {
      for (let gy = 0; gy < gridRes && bIdx < BOUNDARY_SAMPLES; gy++) {
        const px = (gx / gridRes - 0.5) * 10;
        const py = (gy / gridRes - 0.5) * 8;
        const pz = Math.sin(gx * 0.5 + gy * 0.3 + t * 0.2) * 0.5;

        // Find two closest seeds
        let d1 = Infinity, d2 = Infinity;
        let _c1 = 0;
        for (let s = 0; s < SEED_COUNT; s++) {
          const dx = px - seeds[s].x;
          const dy = py - seeds[s].y;
          const d = dx * dx + dy * dy;
          if (d < d1) { d2 = d1; d1 = d; _c1 = s; }
          else if (d < d2) { d2 = d; }
        }

        // Points near boundary (where d1 ~ d2)
        const ratio = d1 / (d2 + 0.001);
        if (ratio > 0.7) {
          arr[bIdx * 3] = px;
          arr[bIdx * 3 + 1] = py;
          arr[bIdx * 3 + 2] = pz;

          // Color intensity based on boundary sharpness
          const edgeIntensity = (ratio - 0.7) / 0.3;
          cArr[bIdx * 3] = 0.29 + edgeIntensity * 0.14 + _c1 * 0.01;
          cArr[bIdx * 3 + 1] = 0.49 + edgeIntensity * 0.1;
          cArr[bIdx * 3 + 2] = 0.35 + edgeIntensity * 0.08;

          bIdx++;
        }
      }
    }

    // Fill remaining with offscreen
    for (let i = bIdx; i < BOUNDARY_SAMPLES; i++) {
      arr[i * 3] = 0;
      arr[i * 3 + 1] = -100;
      arr[i * 3 + 2] = 0;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    const mat = meshRef.current.material as THREE.PointsMaterial;
    mat.opacity = reveal * 0.7;

    const sMat = seedRef.current.material as THREE.PointsMaterial;
    sMat.opacity = reveal * 0.9;
  });

  return (
    <>
      <points ref={meshRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[boundaryPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[boundaryColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={isMobile ? 0.06 : 0.04}
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
          size={isMobile ? 0.18 : 0.14}
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
      <ambientLight intensity={0.03} />
      <pointLight position={[0, 0, 5]} intensity={0.6} color="#4a7c59" distance={15} decay={2} />
      <pointLight position={[-4, 3, 0]} intensity={0.3} color="#c9a84c" distance={10} decay={2} />
      <pointLight position={[3, -2, 2]} intensity={0.2} color="#6ea87e" distance={8} decay={2} />
    </>
  );
}
