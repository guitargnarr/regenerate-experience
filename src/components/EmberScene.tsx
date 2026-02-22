/**
 * Scene I: The Silence (0.03-0.18)
 * A single faint ember in vast darkness. 40 barely-visible dust motes.
 * The ember pulses, draws a few particles closer, then dims. The anti-formation.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function EmberCore({ progress }: { progress: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.03) / 0.15));

    // Ember pulses -- slow, organic
    const pulse = Math.sin(t * 0.8) * 0.5 + 0.5;
    const breathe = Math.sin(t * 0.3) * 0.3 + 0.7;
    const intensity = pulse * breathe * (0.3 + sceneP * 0.5);

    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = intensity * 2;
    mat.opacity = 0.4 + intensity * 0.4;

    const scale = 0.08 + intensity * 0.06;
    meshRef.current.scale.setScalar(scale);

    if (glowRef.current) {
      const glowMat = glowRef.current.material as THREE.MeshStandardMaterial;
      glowMat.emissiveIntensity = intensity * 0.8;
      glowMat.opacity = intensity * 0.15;
      glowRef.current.scale.setScalar(scale * 4 + Math.sin(t * 0.5) * 0.1);
    }
  });

  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color="#c9a84c"
          emissive="#c9a84c"
          emissiveIntensity={1}
          transparent
          opacity={0.6}
        />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color="#0a0d08"
          emissive="#4a7c59"
          emissiveIntensity={0.5}
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>
    </>
  );
}

export function DustMotes({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const COUNT = isMobile ? 25 : 40;
  const meshRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  const { positions, basePositions, velocities } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const base = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);

    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2 + Math.random() * 6;

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      base[i * 3] = pos[i * 3];
      base[i * 3 + 1] = pos[i * 3 + 1];
      base[i * 3 + 2] = pos[i * 3 + 2];

      vel[i * 3] = (Math.random() - 0.5) * 0.02;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }

    return { positions: pos, basePositions: base, velocities: vel };
  }, [COUNT]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.03) / 0.15));
    const posAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    // Pulse phase: during mid-scene, some particles drift toward ember
    const attractPhase = Math.sin(t * 0.4) * 0.5 + 0.5;
    const attractStrength = sceneP * attractPhase * 0.15;

    for (let i = 0; i < COUNT; i++) {
      const bx = basePositions[i * 3];
      const by = basePositions[i * 3 + 1];
      const bz = basePositions[i * 3 + 2];

      // Gentle drift
      const dx = bx + Math.sin(t * 0.15 + i * 1.7) * 0.5 + velocities[i * 3] * t;
      const dy = by + Math.cos(t * 0.12 + i * 2.3) * 0.3 + velocities[i * 3 + 1] * t;
      const dz = bz + Math.sin(t * 0.18 + i * 0.9) * 0.4 + velocities[i * 3 + 2] * t;

      // Attract toward center (ember)
      arr[i * 3] = dx * (1 - attractStrength) + 0 * attractStrength;
      arr[i * 3 + 1] = dy * (1 - attractStrength) + 0 * attractStrength;
      arr[i * 3 + 2] = dz * (1 - attractStrength) + 0 * attractStrength;
    }

    posAttr.needsUpdate = true;

    const mat = meshRef.current.material as THREE.PointsMaterial;
    mat.opacity = 0.1 + sceneP * 0.15;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={isMobile ? 0.04 : 0.03}
        color="#7a8a72"
        transparent
        opacity={0.15}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

export function EmberLighting() {
  return (
    <>
      <ambientLight intensity={0.01} />
      <pointLight position={[0, 0, 0]} intensity={0.5} color="#c9a84c" distance={8} decay={2} />
      <pointLight position={[0, 2, 0]} intensity={0.1} color="#4a7c59" distance={10} decay={2} />
    </>
  );
}
