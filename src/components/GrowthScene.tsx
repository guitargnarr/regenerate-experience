/**
 * Scene II: The Proliferation (0.20-0.35) -- "Erupting Growth"
 * Dense organic tendrils erupt from a central point with custom shaders.
 * Wind-displaced tubes with moss-to-gold gradient, SSS on undersides.
 * Glowing buds at tips. Luminous spores with size pulsing.
 *
 * Custom ShaderMaterial on TubeGeometry for organic feel.
 * Growth is FAST: visible tendrils by 10% into scene, dense by 40%.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ---- Tendril vertex shader: wind sway + vein displacement ---- */
const tendrilVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uGrowth; // 0-1 how much of tube is visible

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Wind sway: increases along tube length (uv.x = 0 at base, 1 at tip)
    float swayAmount = uv.x * uv.x * 0.3;
    pos.x += sin(uTime * 1.2 + pos.y * 0.8) * swayAmount;
    pos.z += cos(uTime * 0.9 + pos.y * 0.6) * swayAmount * 0.5;

    // Organic pulse: slight radial throb
    float pulse = 1.0 + sin(uTime * 2.0 + uv.x * 10.0) * 0.06 * uv.x;
    pos.x *= pulse;
    pos.z *= pulse;

    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

/* ---- Tendril fragment shader: gradient + SSS + bark texture + vein detail ---- */
const tendrilFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uGrowth;
  uniform vec3 uMossColor;
  uniform vec3 uGoldColor;
  uniform vec3 uRoseColor;
  uniform float uDepthFactor; // 1.0 for main, 0.7 for branches
  uniform sampler2D uBarkTex;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    float t = vUv.x; // along tube: 0=base, 1=tip

    // Moss at base, gold at tip
    vec3 baseColor = mix(uMossColor, uGoldColor, t * t);

    // Blend in bark photo texture (40% photo, 60% procedural)
    vec3 barkColor = texture2D(uBarkTex, vUv * vec2(1.0, 3.0)).rgb;
    baseColor = mix(baseColor, barkColor * 0.5, 0.4);

    // Vein pattern: longitudinal darker bands
    float vein = sin(vUv.y * 30.0 + t * 5.0) * 0.5 + 0.5;
    vein = smoothstep(0.3, 0.7, vein);
    baseColor = mix(baseColor * 0.7, baseColor, vein);

    // Main light from above-right
    vec3 L = normalize(vec3(0.3, 1.0, 0.5));
    float NdotL = max(dot(N, L), 0.0);

    // Subsurface scattering: light wraps around from behind
    float wrap = max(0.0, dot(N, -L) * 0.5 + 0.5);
    float sss = pow(wrap, 2.5) * 0.5;
    vec3 sssColor = mix(uMossColor, uRoseColor, 0.3) * sss;

    // Fresnel rim
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 rimColor = mix(uMossColor, uGoldColor, t) * fresnel * 0.6;

    // Specular
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 32.0) * 0.4;
    vec3 specColor = uGoldColor * spec;

    // Combine
    vec3 diffuse = baseColor * (NdotL * 0.5 + 0.25);
    vec3 color = (diffuse + sssColor + rimColor + specColor) * uDepthFactor;

    // Tip emission glow
    float tipGlow = smoothstep(0.7, 1.0, t) * 0.4;
    color += uGoldColor * tipGlow;

    // Growth fade: alpha falls to 0 beyond growth front
    float growthFade = smoothstep(uGrowth, uGrowth - 0.05, t);
    float alpha = growthFade * 0.92;

    gl_FragColor = vec4(color, alpha);
  }
`;

/* ---- Spore vertex shader with glow ---- */
const sporeVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    #ifdef USE_INSTANCING
      vec4 ip = instanceMatrix * vec4(position, 1.0);
      vec4 wp = modelMatrix * ip;
    #else
      vec4 wp = modelMatrix * vec4(position, 1.0);
    #endif
    vWorldPos = wp.xyz;
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const sporeFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uGlow;

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);

    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.0);
    vec3 color = uColor * (0.4 + fresnel * 0.6) + uColor * uGlow;

    float alpha = 0.5 + fresnel * 0.4;
    gl_FragColor = vec4(color, alpha);
  }
`;

interface TendrilPath {
  curve: THREE.CatmullRomCurve3;
  points: THREE.Vector3[];
  growthOrder: number;
  depth: number;
}

export function generateTendrilPaths(count: number): TendrilPath[] {
  const rand = seededRandom(77);
  const paths: TendrilPath[] = [];
  const mainCount = Math.min(count, 22);

  for (let m = 0; m < mainCount; m++) {
    const phi = rand() * Math.PI * 2;
    const theta = rand() * Math.PI * 0.7;
    const dir = new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.sin(theta) * Math.sin(phi) * 0.6 + 0.4,
      Math.cos(theta) * 0.3
    ).normalize();

    const segCount = 7 + Math.floor(rand() * 5);
    const segLen = 0.7 + rand() * 0.5;
    const points: THREE.Vector3[] = [new THREE.Vector3(0, -2, 0)];
    let currentDir = dir.clone();
    let pos = points[0].clone();

    for (let s = 0; s < segCount; s++) {
      pos = pos.clone().add(currentDir.clone().multiplyScalar(segLen));
      points.push(pos.clone());
      const bendAxis = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      currentDir.applyAxisAngle(bendAxis, (rand() - 0.5) * 0.45);
      currentDir.normalize();
    }

    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    paths.push({ curve, points, growthOrder: m / mainCount, depth: 0 });

    // Branch from midpoint -- more branching for density
    if (rand() > 0.25 && paths.length < count) {
      const branchStart = Math.floor(points.length * (0.3 + rand() * 0.3));
      const branchDir = currentDir.clone();
      const branchAxis = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      branchDir.applyAxisAngle(branchAxis, 0.5 + rand() * 0.6);
      branchDir.normalize();

      const branchPts: THREE.Vector3[] = [points[Math.min(branchStart, points.length - 1)].clone()];
      let bPos = branchPts[0].clone();
      let bDir = branchDir.clone();

      for (let b = 0; b < 4 + Math.floor(rand() * 3); b++) {
        bPos = bPos.clone().add(bDir.clone().multiplyScalar(segLen * 0.6));
        branchPts.push(bPos.clone());
        const ba = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
        bDir.applyAxisAngle(ba, (rand() - 0.5) * 0.6);
        bDir.normalize();
      }

      if (branchPts.length >= 3) {
        const bCurve = new THREE.CatmullRomCurve3(branchPts, false, 'catmullrom', 0.5);
        paths.push({ curve: bCurve, points: branchPts, growthOrder: m / mainCount + 0.1, depth: 1 });
      }
    }

    // Second branch for extra density
    if (rand() > 0.5 && paths.length < count) {
      const branchStart = Math.floor(points.length * (0.5 + rand() * 0.3));
      const branchDir = new THREE.Vector3(rand() - 0.5, rand() * 0.8, rand() - 0.5).normalize();

      const branchPts: THREE.Vector3[] = [points[Math.min(branchStart, points.length - 1)].clone()];
      let bPos = branchPts[0].clone();
      let bDir = branchDir.clone();

      for (let b = 0; b < 3 + Math.floor(rand() * 2); b++) {
        bPos = bPos.clone().add(bDir.clone().multiplyScalar(segLen * 0.5));
        branchPts.push(bPos.clone());
        const ba = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
        bDir.applyAxisAngle(ba, (rand() - 0.5) * 0.5);
        bDir.normalize();
      }

      if (branchPts.length >= 3) {
        const bCurve = new THREE.CatmullRomCurve3(branchPts, false, 'catmullrom', 0.5);
        paths.push({ curve: bCurve, points: branchPts, growthOrder: m / mainCount + 0.2, depth: 1 });
      }
    }
  }

  return paths.slice(0, count);
}

export function TreeBranches({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const TENDRIL_COUNT = isMobile ? 18 : 36;
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  const barkTex = useMemo(() => {
    const tex = new THREE.TextureLoader().load("/textures/moss-bark.jpg");
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, []);

  const { tendrilPaths, tubeGeos, shaderMats } = useMemo(() => {
    const paths = generateTendrilPaths(TENDRIL_COUNT);

    const geos = paths.map((p) => {
      const radius = p.depth === 0 ? 0.14 : 0.08;
      return new THREE.TubeGeometry(p.curve, isMobile ? 20 : 28, radius, 8, false);
    });

    const mats = paths.map((p) => {
      return new THREE.ShaderMaterial({
        vertexShader: tendrilVertexShader,
        fragmentShader: tendrilFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uGrowth: { value: 0 },
          uMossColor: { value: new THREE.Color(0x4a7c59) },
          uGoldColor: { value: new THREE.Color(0xc9a84c) },
          uRoseColor: { value: new THREE.Color(0xd4918a) },
          uDepthFactor: { value: p.depth === 0 ? 1.0 : 0.75 },
          uBarkTex: { value: barkTex },
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
    });

    return { tendrilPaths: paths, tubeGeos: geos, shaderMats: mats };
  }, [TENDRIL_COUNT, isMobile]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.20) / 0.15));

    for (let i = 0; i < tendrilPaths.length; i++) {
      const path = tendrilPaths[i];
      const mat = shaderMats[i];

      // FAST growth: first tendrils visible immediately, all visible by 50%
      const growthStart = path.growthOrder * 0.3; // compressed: starts early
      const localGrowth = Math.max(0, Math.min(1, (sceneP - growthStart) / 0.5));

      mat.uniforms.uTime.value = t;
      mat.uniforms.uGrowth.value = localGrowth;
    }

    groupRef.current.rotation.y = Math.sin(t * 0.12) * 0.06;
  });

  return (
    <group ref={groupRef}>
      {tubeGeos.map((geo, i) => (
        <mesh key={i} geometry={geo} material={shaderMats[i]} />
      ))}
    </group>
  );
}

export function BranchParticles({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const SPORE_COUNT = isMobile ? 60 : 150;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const { sporeData, sporeMat } = useMemo(() => {
    const rand = seededRandom(99);
    const data: { basePos: THREE.Vector3; velocity: THREE.Vector3; phase: number }[] = [];

    for (let i = 0; i < SPORE_COUNT; i++) {
      const phi = rand() * Math.PI * 2;
      const theta = rand() * Math.PI * 0.85;
      const r = 1.0 + rand() * 3.5;
      data.push({
        basePos: new THREE.Vector3(
          Math.sin(theta) * Math.cos(phi) * r,
          Math.sin(theta) * Math.sin(phi) * r * 0.6 + 0.5,
          Math.cos(theta) * r * 0.3
        ),
        velocity: new THREE.Vector3(
          (rand() - 0.5) * 0.25,
          rand() * 0.15 + 0.03,
          (rand() - 0.5) * 0.12
        ),
        phase: rand() * Math.PI * 2,
      });
    }

    const mat = new THREE.ShaderMaterial({
      vertexShader: sporeVertexShader,
      fragmentShader: sporeFragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color(0x6ea87e) },
        uGlow: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { sporeData: data, sporeMat: mat };
  }, [SPORE_COUNT]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.20) / 0.15));

    // Spores appear earlier: at 20% into scene
    const sporePhase = Math.max(0, (sceneP - 0.2) / 0.8);
    sporeMat.uniforms.uGlow.value = sporePhase * 0.8;

    for (let i = 0; i < SPORE_COUNT; i++) {
      const s = sporeData[i];
      dummy.position.set(
        s.basePos.x + Math.sin(t * 0.5 + s.phase) * 0.4 + s.velocity.x * t * sporePhase,
        s.basePos.y + s.velocity.y * t * sporePhase + Math.sin(t * 0.8 + s.phase) * 0.15,
        s.basePos.z + Math.cos(t * 0.4 + s.phase) * 0.25 + s.velocity.z * t * sporePhase
      );
      const pulseScale = sporePhase * (0.6 + Math.sin(t * 2.5 + s.phase) * 0.4);
      dummy.scale.setScalar(Math.max(0.01, pulseScale));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, sporeMat, SPORE_COUNT]}>
      <sphereGeometry args={[0.08, 8, 8]} />
    </instancedMesh>
  );
}

export function LeafBuds({ progress, isMobile, tipPositions }: { progress: number; isMobile: boolean; tipPositions?: THREE.Vector3[] }) {
  const BUD_COUNT = isMobile ? 16 : 30;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const leafTex = useMemo(() => {
    const tex = new THREE.TextureLoader().load("/textures/leaf-macro.jpg");
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const { budData, budMat } = useMemo(() => {
    const tips = tipPositions ?? generateTendrilPaths(isMobile ? 18 : 36).map(p => p.points[p.points.length - 1]);
    const data = tips.slice(0, BUD_COUNT).map((tip, i) => {
      const rand = seededRandom(55 + i);
      return {
        position: tip.clone(),
        phase: rand() * Math.PI * 2,
        isRose: rand() > 0.5,
      };
    });

    const mat = new THREE.MeshPhysicalMaterial({
      map: leafTex,
      color: 0xd4918a,
      emissive: 0xc9a84c,
      emissiveIntensity: 0.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.15,
      transparent: true,
      opacity: 0,
      roughness: 0.3,
      metalness: 0.15,
    });

    return { budData: data, budMat: mat };
  }, [BUD_COUNT, isMobile, tipPositions]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.20) / 0.15));

    // Buds appear earlier: at 30% into scene
    const budPhase = Math.max(0, (sceneP - 0.3) / 0.7);
    const blend = Math.sin(t * 0.8) * 0.5 + 0.5; // smooth 0-1 oscillation
    budMat.emissive.setRGB(
      0.83 * (1 - blend) + 0.79 * blend,  // rose r -> gold r
      0.57 * (1 - blend) + 0.66 * blend,  // rose g -> gold g
      0.54 * (1 - blend) + 0.30 * blend,  // rose b -> gold b
    );
    budMat.emissiveIntensity = 0.4 + budPhase * 0.8;
    budMat.opacity = budPhase * 0.95;

    for (let i = 0; i < budData.length; i++) {
      const b = budData[i];
      dummy.position.copy(b.position);
      const bloomScale = budPhase * (0.8 + Math.sin(t * 1.5 + b.phase) * 0.3);
      dummy.scale.setScalar(Math.max(0.01, bloomScale));
      dummy.rotation.x = Math.sin(t * 0.5 + b.phase) * 0.3;
      dummy.rotation.y = t * 0.3 + b.phase;
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, budMat, BUD_COUNT]}>
      <dodecahedronGeometry args={[0.35, 1]} />
    </instancedMesh>
  );
}

export function LeafParticles({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const COUNT = isMobile ? 40 : 100;
  const meshRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  const fernTex = useMemo(() => {
    const tex = new THREE.TextureLoader().load("/textures/fern-alpha.jpg");
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const { positions, basePositions } = useMemo(() => {
    const rand = seededRandom(123);
    const p = new Float32Array(COUNT * 3);
    const base = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const phi = rand() * Math.PI * 2;
      const theta = Math.acos(2 * rand() - 1);
      const r = 1.5 + rand() * 3.5;
      const x = r * Math.sin(theta) * Math.cos(phi);
      const y = r * Math.sin(theta) * Math.sin(phi) * 0.6 + 1.5;
      const z = r * Math.cos(theta) * 0.3;
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
      base[i * 3] = x; base[i * 3 + 1] = y; base[i * 3 + 2] = z;
    }
    return { positions: p, basePositions: base };
  }, [COUNT]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.21) / 0.15));
    const leafPhase = Math.max(0, (sceneP - 0.4) / 0.6);

    const posAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = basePositions[i * 3] + Math.sin(t * 0.3 + i * 0.5) * 0.2;
      arr[i * 3 + 1] = basePositions[i * 3 + 1] + Math.cos(t * 0.2 + i * 0.7) * 0.15;
      arr[i * 3 + 2] = basePositions[i * 3 + 2] + Math.sin(t * 0.15 + i * 0.9) * 0.1;
    }
    posAttr.needsUpdate = true;

    const mat = meshRef.current.material as THREE.PointsMaterial;
    mat.opacity = leafPhase * 0.6;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={fernTex}
        size={isMobile ? 0.4 : 0.3}
        color="#4a7c59"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

export function GrowthBackdrop({ progress }: { progress: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const foliageTex = useMemo(() => {
    const tex = new THREE.TextureLoader().load("/textures/foliage-bg.jpg");
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.21) / 0.15));
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = sceneP * 0.2;
  });

  return (
    <mesh ref={meshRef} position={[0, 2, -6]} scale={[16, 8, 1]}>
      <planeGeometry />
      <meshBasicMaterial
        map={foliageTex}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

export function GrowthLighting() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 8, 5]} intensity={6} color="#4a7c59" distance={30} decay={2} />
      <pointLight position={[-5, -1, 4]} intensity={3} color="#c9a84c" distance={25} decay={2} />
      <pointLight position={[4, 5, -3]} intensity={2.5} color="#d4918a" distance={22} decay={2} />
      <pointLight position={[0, -4, 2]} intensity={2} color="#d4918a" distance={18} decay={2} />
      <pointLight position={[0, 3, 8]} intensity={3} color="#e4dcc8" distance={22} decay={2} />
    </>
  );
}
