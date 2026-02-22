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

  let seedState = 42;
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

      const t = branch.depth / 7;
      // Start vertex: vivid green -> gold at tips
      col[i * 6] = 0.45 + t * 0.50;
      col[i * 6 + 1] = 0.85 - t * 0.10;
      col[i * 6 + 2] = 0.50 - t * 0.20;
      // End vertex
      col[i * 6 + 3] = 0.50 + t * 0.50;
      col[i * 6 + 4] = 0.85 - t * 0.15;
      col[i * 6 + 5] = 0.50 - t * 0.25;
    }

    return { branches: b, positions: pos, colors: col };
  }, [isMobile]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.20) / 0.15));

    const posAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    const maxVisibleDepth = sceneP * 8;

    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];
      if (branch.depth <= maxVisibleDepth) {
        const branchProgress = Math.min(1, (maxVisibleDepth - branch.depth) * 2);
        arr[i * 6 + 3] = branch.start.x + (branch.end.x - branch.start.x) * branchProgress;
        arr[i * 6 + 4] = branch.start.y + (branch.end.y - branch.start.y) * branchProgress;
        arr[i * 6 + 5] = branch.start.z + (branch.end.z - branch.start.z) * branchProgress;
      } else {
        arr[i * 6 + 3] = arr[i * 6];
        arr[i * 6 + 4] = arr[i * 6 + 1];
        arr[i * 6 + 5] = arr[i * 6 + 2];
      }
    }

    posAttr.needsUpdate = true;

    const t = timeRef.current;
    meshRef.current.rotation.y = Math.sin(t * 0.15) * 0.05;

    const mat = meshRef.current.material as THREE.LineBasicMaterial;
    mat.opacity = 0.85 + sceneP * 0.15;
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
        opacity={0.95}
        linewidth={1}
      />
    </lineSegments>
  );
}

export function BranchParticles({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const SAMPLES_PER_BRANCH = 3;
  const meshRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  const { branchData, positions, colors } = useMemo(() => {
    const b = generateTree(isMobile ? 5 : 7);
    const total = b.length * SAMPLES_PER_BRANCH;
    const pos = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    const data: Array<{ depth: number; points: Array<{ x: number; y: number; z: number }> }> = [];

    for (let i = 0; i < b.length; i++) {
      const branch = b[i];
      const pts: Array<{ x: number; y: number; z: number }> = [];
      for (let s = 0; s < SAMPLES_PER_BRANCH; s++) {
        const frac = (s + 0.5) / SAMPLES_PER_BRANCH;
        const idx = (i * SAMPLES_PER_BRANCH + s) * 3;
        const x = branch.start.x + (branch.end.x - branch.start.x) * frac;
        const y = branch.start.y + (branch.end.y - branch.start.y) * frac;
        const z = branch.start.z + (branch.end.z - branch.start.z) * frac;
        pos[idx] = x;
        pos[idx + 1] = y;
        pos[idx + 2] = z;
        pts.push({ x, y, z });

        const t = branch.depth / 7;
        col[idx] = 0.50 + t * 0.45;
        col[idx + 1] = 0.85 - t * 0.10;
        col[idx + 2] = 0.50 - t * 0.20;
      }
      data.push({ depth: branch.depth, points: pts });
    }

    return { branchData: data, positions: pos, colors: col };
  }, [isMobile]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.20) / 0.15));
    const maxVisibleDepth = sceneP * 8;

    const posAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < branchData.length; i++) {
      const bd = branchData[i];
      for (let s = 0; s < SAMPLES_PER_BRANCH; s++) {
        const idx = (i * SAMPLES_PER_BRANCH + s) * 3;
        if (bd.depth <= maxVisibleDepth) {
          arr[idx] = bd.points[s].x;
          arr[idx + 1] = bd.points[s].y;
          arr[idx + 2] = bd.points[s].z;
        } else {
          arr[idx + 1] = -100; // hide
        }
      }
    }

    posAttr.needsUpdate = true;
    meshRef.current.rotation.y = Math.sin(timeRef.current * 0.15) * 0.05;

    const mat = meshRef.current.material as THREE.PointsMaterial;
    mat.opacity = sceneP * 0.7;
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
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

export function LeafBuds({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const COUNT = isMobile ? 40 : 80;
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

      const isRose = i % 3 === 0;
      col[i * 3] = isRose ? 0.90 : 0.85;
      col[i * 3 + 1] = isRose ? 0.62 : 0.72;
      col[i * 3 + 2] = isRose ? 0.58 : 0.35;
    }

    return { positions: pos, colors: col };
  }, [COUNT, isMobile]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.20) / 0.15));

    const mat = meshRef.current.material as THREE.PointsMaterial;
    const budPhase = Math.max(0, (sceneP - 0.3) / 0.7);
    mat.opacity = budPhase * 0.9;
    mat.size = (isMobile ? 0.18 : 0.14) * budPhase + Math.sin(t * 2) * 0.02;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.14}
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
      <ambientLight intensity={0.08} />
      <pointLight position={[0, 5, 3]} intensity={1.5} color="#4a7c59" distance={18} decay={2} />
      <pointLight position={[-3, -1, 2]} intensity={0.8} color="#c9a84c" distance={14} decay={2} />
      <pointLight position={[2, 3, -2]} intensity={0.5} color="#d4918a" distance={10} decay={2} />
    </>
  );
}
