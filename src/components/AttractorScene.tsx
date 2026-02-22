/**
 * Scene V: The Spark (0.71-0.86)
 * Lorenz Attractor drawing itself. The butterfly curve traces from green through gold to cream.
 * Spark particles race along the path. The chaos was never chaos --
 * it was a deterministic system all along.
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame, extend } from "@react-three/fiber";
import * as THREE from "three";

// Extend so R3F knows about THREE.Line as <threeJSLine>
extend({ ThreeLine: THREE.Line });

// Lorenz system parameters
const SIGMA = 10;
const RHO = 28;
const BETA = 8 / 3;
const DT = 0.005;
const SCALE = 0.15;

function integrateLorenz(steps: number): Float32Array {
  const points = new Float32Array(steps * 3);
  let x = 0.1, y = 0, z = 0;

  for (let i = 0; i < steps; i++) {
    const dx = SIGMA * (y - x);
    const dy = x * (RHO - z) - y;
    const dz = x * y - BETA * z;

    x += dx * DT;
    y += dy * DT;
    z += dz * DT;

    points[i * 3] = x * SCALE;
    points[i * 3 + 1] = (z - 25) * SCALE; // Center vertically
    points[i * 3 + 2] = y * SCALE;
  }

  return points;
}

export function AttractorPath({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const TOTAL_POINTS = isMobile ? 4000 : 8000;
  const groupRef = useRef<THREE.Group>(null);
  const lineObjRef = useRef<THREE.Line | null>(null);
  const timeRef = useRef(0);

  const { allPoints, colors } = useMemo(() => {
    const pts = integrateLorenz(TOTAL_POINTS);
    const col = new Float32Array(TOTAL_POINTS * 3);

    for (let i = 0; i < TOTAL_POINTS; i++) {
      const t = i / TOTAL_POINTS;
      if (t < 0.33) {
        const s = t / 0.33;
        col[i * 3] = 0.29 + s * 0.5;
        col[i * 3 + 1] = 0.49 - s * 0.1;
        col[i * 3 + 2] = 0.35 - s * 0.15;
      } else if (t < 0.66) {
        const s = (t - 0.33) / 0.33;
        col[i * 3] = 0.79 + s * 0.1;
        col[i * 3 + 1] = 0.66 + s * 0.2;
        col[i * 3 + 2] = 0.30 + s * 0.48;
      } else {
        col[i * 3] = 0.89;
        col[i * 3 + 1] = 0.86;
        col[i * 3 + 2] = 0.78;
      }
    }

    return { allPoints: pts, colors: col };
  }, [TOTAL_POINTS]);

  useEffect(() => {
    if (!groupRef.current) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(allPoints, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    const line = new THREE.Line(geometry, material);
    groupRef.current.add(line);
    lineObjRef.current = line;

    return () => {
      groupRef.current?.remove(line);
      geometry.dispose();
      material.dispose();
    };
  }, [allPoints, colors]);

  useFrame((_, delta) => {
    if (!lineObjRef.current) return;
    timeRef.current += delta;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.71) / 0.15));

    const visiblePoints = Math.floor(sceneP * TOTAL_POINTS);
    lineObjRef.current.geometry.setDrawRange(0, visiblePoints);

    const mat = lineObjRef.current.material as THREE.LineBasicMaterial;
    mat.opacity = 0.6 + sceneP * 0.3;

    lineObjRef.current.rotation.y = timeRef.current * 0.05;
  });

  return <group ref={groupRef} />;
}

export function SparkParticles({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const SPARK_COUNT = isMobile ? 20 : 40;
  const PATH_POINTS = isMobile ? 4000 : 8000;
  const meshRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  const { positions, pathData } = useMemo(() => {
    const pos = new Float32Array(SPARK_COUNT * 3);
    const path = integrateLorenz(PATH_POINTS);
    return { positions: pos, pathData: path };
  }, [SPARK_COUNT, PATH_POINTS]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.71) / 0.15));

    const posAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    const visiblePath = Math.floor(sceneP * PATH_POINTS);
    if (visiblePath < 2) return;

    for (let i = 0; i < SPARK_COUNT; i++) {
      // Each spark races along the revealed path
      const sparkSpeed = 0.05 + (i / SPARK_COUNT) * 0.1;
      const pathIdx = Math.floor(((t * sparkSpeed * 200 + i * (PATH_POINTS / SPARK_COUNT)) % visiblePath));
      const clampedIdx = Math.max(0, Math.min(pathIdx, PATH_POINTS - 1));

      arr[i * 3] = pathData[clampedIdx * 3];
      arr[i * 3 + 1] = pathData[clampedIdx * 3 + 1];
      arr[i * 3 + 2] = pathData[clampedIdx * 3 + 2];
    }

    posAttr.needsUpdate = true;

    // Rotate with path
    meshRef.current.rotation.y = t * 0.05;

    const mat = meshRef.current.material as THREE.PointsMaterial;
    mat.opacity = sceneP * 0.8;
    mat.size = (isMobile ? 0.1 : 0.08) + Math.sin(t * 4) * 0.02;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color="#e2cc7a"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

export function AttractorGlow({ progress }: { progress: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.71) / 0.15));

    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = sceneP * 0.3 + Math.sin(t * 0.5) * 0.1;
    mat.opacity = sceneP * 0.08;
    meshRef.current.scale.setScalar(3 + sceneP * 2);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 24, 24]} />
      <meshStandardMaterial
        color="#0a0d08"
        emissive="#4a7c59"
        emissiveIntensity={0}
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
      />
    </mesh>
  );
}

export function AttractorLighting() {
  return (
    <>
      <ambientLight intensity={0.04} />
      <pointLight position={[0, 3, 5]} intensity={0.8} color="#c9a84c" distance={15} decay={2} />
      <pointLight position={[-3, -2, 3]} intensity={0.4} color="#4a7c59" distance={12} decay={2} />
      <pointLight position={[4, 1, -3]} intensity={0.3} color="#e4dcc8" distance={10} decay={2} />
    </>
  );
}
