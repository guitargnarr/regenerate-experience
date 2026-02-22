/**
 * PostEffects: Faux bloom via an emissive overlay sphere.
 * Simulates bloom ignition in Scene V without EffectComposer
 * (which causes alpha errors in this R3F + Three.js version combo).
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function PostEffects({ progress }: { progress: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.71) / 0.15));
    const ignitionP = Math.max(0, (sceneP - 0.6) / 0.4);
    const smoothIgnition = ignitionP * ignitionP * (3 - 2 * ignitionP);

    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = smoothIgnition * 0.35;

    // Scale to fill view
    meshRef.current.visible = smoothIgnition > 0.01;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[50, 16, 16]} />
      <meshBasicMaterial
        color="#e4dcc8"
        transparent
        opacity={0}
        side={THREE.BackSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
