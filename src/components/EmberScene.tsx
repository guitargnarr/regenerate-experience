/**
 * Scene I: The Silence (0.03-0.18)
 * A single ember in vast darkness. Dust motes drift around it.
 * The ember pulses, draws particles closer, then dims. The anti-formation.
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

    const pulse = Math.sin(t * 0.8) * 0.5 + 0.5;
    const breathe = Math.sin(t * 0.3) * 0.3 + 0.7;
    const intensity = pulse * breathe * (0.5 + sceneP * 0.5);

    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = intensity * 4;
    mat.opacity = 0.6 + intensity * 0.4;

    const scale = 0.25 + intensity * 0.15;
    meshRef.current.scale.setScalar(scale);

    if (glowRef.current) {
      const glowMat = glowRef.current.material as THREE.MeshStandardMaterial;
      glowMat.emissiveIntensity = intensity * 1.5;
      glowMat.opacity = intensity * 0.25;
      glowRef.current.scale.setScalar(scale * 5 + Math.sin(t * 0.5) * 0.3);
    }
  });

  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color="#c9a84c"
          emissive="#c9a84c"
          emissiveIntensity={2}
          transparent
          opacity={0.8}
        />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color="#0a0d08"
          emissive="#4a7c59"
          emissiveIntensity={1}
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>
    </>
  );
}

export function DustMotes({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const COUNT = isMobile ? 40 : 80;
  const meshRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  const { positions, basePositions, velocities } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const base = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);

    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.5 + Math.random() * 5;

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

    const attractPhase = Math.sin(t * 0.4) * 0.5 + 0.5;
    const attractStrength = sceneP * attractPhase * 0.15;

    for (let i = 0; i < COUNT; i++) {
      const bx = basePositions[i * 3];
      const by = basePositions[i * 3 + 1];
      const bz = basePositions[i * 3 + 2];

      const dx = bx + Math.sin(t * 0.15 + i * 1.7) * 0.5 + velocities[i * 3] * t;
      const dy = by + Math.cos(t * 0.12 + i * 2.3) * 0.3 + velocities[i * 3 + 1] * t;
      const dz = bz + Math.sin(t * 0.18 + i * 0.9) * 0.4 + velocities[i * 3 + 2] * t;

      arr[i * 3] = dx * (1 - attractStrength);
      arr[i * 3 + 1] = dy * (1 - attractStrength);
      arr[i * 3 + 2] = dz * (1 - attractStrength);
    }

    posAttr.needsUpdate = true;

    const mat = meshRef.current.material as THREE.PointsMaterial;
    mat.opacity = 0.35 + sceneP * 0.4;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={isMobile ? 0.08 : 0.06}
        color="#6ea87e"
        transparent
        opacity={0.4}
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
      <ambientLight intensity={0.06} />
      <pointLight position={[0, 0, 0]} intensity={2.0} color="#c9a84c" distance={15} decay={2} />
      <pointLight position={[0, 3, 0]} intensity={0.5} color="#4a7c59" distance={12} decay={2} />
      <pointLight position={[2, -1, 3]} intensity={0.3} color="#e2cc7a" distance={10} decay={2} />
    </>
  );
}
