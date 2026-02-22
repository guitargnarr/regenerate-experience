/**
 * Scene II: The Proliferation (0.20-0.35)
 * L-System tree growing chaotically. Trunk appears, branches erupt in every direction,
 * leaf buds pop at tips in rose/gold. Organic, uncontrolled growth.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Branch {
  start: THREE.Vector3;
  end: THREE.Vector3;
  depth: number;
  angle: number;
  length: number;
}

function generateTree(maxDepth: number): Branch[] {
  const branches: Branch[] = [];
  const stack: Array<{ pos: THREE.Vector3; dir: THREE.Vector3; depth: number }> = [];

  stack.push({
    pos: new THREE.Vector3(0, -3, 0),
    dir: new THREE.Vector3(0, 1, 0),
    depth: 0,
  });

  const seed = 42;
  let seedState = seed;
  const seededRandom = () => {
    seedState = (seedState * 16807) % 2147483647;
    return (seedState - 1) / 2147483646;
  };

  while (stack.length > 0 && branches.length < 300) {
    const { pos, dir, depth } = stack.pop()!;
    if (depth > maxDepth) continue;

    const length = (1.2 - depth * 0.12) * (0.7 + seededRandom() * 0.6);
    const end = pos.clone().add(dir.clone().multiplyScalar(length));

    branches.push({
      start: pos.clone(),
      end: end.clone(),
      depth,
      angle: Math.atan2(dir.x, dir.y),
      length,
    });

    if (depth < maxDepth) {
      const numChildren = depth < 2 ? 3 : 2 + Math.floor(seededRandom() * 2);
      for (let c = 0; c < numChildren; c++) {
        const spread = 0.3 + seededRandom() * 0.5;
        const twist = (seededRandom() - 0.5) * Math.PI * 2;
        const childDir = dir.clone();

        // Rotate around random axis
        const axis = new THREE.Vector3(
          Math.sin(twist) * spread,
          Math.cos(spread * 0.5),
          Math.cos(twist) * spread
        ).normalize();
        childDir.applyAxisAngle(axis, spread);

        stack.push({ pos: end.clone(), dir: childDir.normalize(), depth: depth + 1 });
      }
    }
  }

  return branches;
}

export function TreeBranches({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const meshRef = useRef<THREE.LineSegments>(null);
  const timeRef = useRef(0);

  const { branches, positions, colors } = useMemo(() => {
    const b = generateTree(isMobile ? 5 : 7);
    const pos = new Float32Array(b.length * 6);
    const col = new Float32Array(b.length * 6);

    for (let i = 0; i < b.length; i++) {
      const branch = b[i];
      pos[i * 6] = branch.start.x;
      pos[i * 6 + 1] = branch.start.y;
      pos[i * 6 + 2] = branch.start.z;
      pos[i * 6 + 3] = branch.end.x;
      pos[i * 6 + 4] = branch.end.y;
      pos[i * 6 + 5] = branch.end.z;

      // Color: trunk = moss, tips = gold/rose
      const t = branch.depth / 7;
      // Start vertex
      col[i * 6] = 0.29 + t * 0.5;     // R: moss -> gold
      col[i * 6 + 1] = 0.49 - t * 0.1;  // G: moss -> less green
      col[i * 6 + 2] = 0.35 - t * 0.15; // B: moss -> warm
      // End vertex
      col[i * 6 + 3] = 0.29 + t * 0.55;
      col[i * 6 + 4] = 0.49 - t * 0.15;
      col[i * 6 + 5] = 0.35 - t * 0.2;
    }

    return { branches: b, positions: pos, colors: col };
  }, [isMobile]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.20) / 0.15));

    // Reveal branches progressively based on depth
    const posAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    const maxVisibleDepth = sceneP * 8;

    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];
      if (branch.depth <= maxVisibleDepth) {
        // Grow from start toward end
        const branchProgress = Math.min(1, (maxVisibleDepth - branch.depth) * 2);
        arr[i * 6 + 3] = branch.start.x + (branch.end.x - branch.start.x) * branchProgress;
        arr[i * 6 + 4] = branch.start.y + (branch.end.y - branch.start.y) * branchProgress;
        arr[i * 6 + 5] = branch.start.z + (branch.end.z - branch.start.z) * branchProgress;
      } else {
        // Hidden: collapse to start point
        arr[i * 6 + 3] = arr[i * 6];
        arr[i * 6 + 4] = arr[i * 6 + 1];
        arr[i * 6 + 5] = arr[i * 6 + 2];
      }
    }

    posAttr.needsUpdate = true;

    // Gentle sway
    const t = timeRef.current;
    meshRef.current.rotation.y = Math.sin(t * 0.15) * 0.05;
  });

  return (
    <lineSegments ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        linewidth={1}
      />
    </lineSegments>
  );
}

export function LeafBuds({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const COUNT = isMobile ? 30 : 60;
  const meshRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  const { positions, colors } = useMemo(() => {
    const b = generateTree(isMobile ? 5 : 7);
    const tips = b.filter(branch => branch.depth >= (isMobile ? 4 : 5));
    const count = Math.min(COUNT, tips.length);

    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const tip = tips[i % tips.length];
      pos[i * 3] = tip.end.x;
      pos[i * 3 + 1] = tip.end.y;
      pos[i * 3 + 2] = tip.end.z;

      // Rose or gold buds
      const isRose = i % 3 === 0;
      col[i * 3] = isRose ? 0.83 : 0.79;
      col[i * 3 + 1] = isRose ? 0.57 : 0.66;
      col[i * 3 + 2] = isRose ? 0.54 : 0.30;
    }

    return { positions: pos, colors: col };
  }, [COUNT, isMobile]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.20) / 0.15));

    const mat = meshRef.current.material as THREE.PointsMaterial;
    // Buds appear in latter half of scene
    const budPhase = Math.max(0, (sceneP - 0.4) / 0.6);
    mat.opacity = budPhase * 0.8;
    mat.size = (isMobile ? 0.1 : 0.08) * budPhase + Math.sin(t * 2) * 0.01;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        vertexColors
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

export function GrowthLighting() {
  return (
    <>
      <ambientLight intensity={0.04} />
      <pointLight position={[0, 5, 3]} intensity={0.8} color="#4a7c59" distance={15} decay={2} />
      <pointLight position={[-3, -1, 2]} intensity={0.4} color="#c9a84c" distance={10} decay={2} />
      <pointLight position={[2, 3, -2]} intensity={0.3} color="#d4918a" distance={8} decay={2} />
    </>
  );
}
