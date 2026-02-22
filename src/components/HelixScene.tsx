/**
 * Scene IV: The Convergence (0.54-0.69) -- "Assembling Architecture"
 * Scattered geometric fragments orbit in chaos, then assemble into a coherent
 * double-helix tower. Metallic surfaces with gold specular. Edge glow where
 * pieces approach their target. ONLY scene with real shadows.
 *
 * Camera orbits at radius 8, low angle -- helix fills ~80% of viewport height.
 * Helix: radius 2, height 6, 2.5 turns.
 * Scatter radius: 5-8 units (visible at camera distance 8).
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const HELIX_RADIUS = 3.0;
const HELIX_HEIGHT = 10;
const HELIX_TURNS = 2.5;

/* ---- Metallic fragment shader with edge glow ---- */
const metalVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  void main() {
    // Apply instance transform for InstancedMesh
    #ifdef USE_INSTANCING
      vec4 instancePos = instanceMatrix * vec4(position, 1.0);
      vec4 wp = modelMatrix * instancePos;
      // Transform normal by instance rotation (upper-left 3x3)
      mat3 instanceNormalMat = mat3(instanceMatrix);
      vNormal = normalize(normalMatrix * instanceNormalMat * normal);
    #else
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
    #endif
    vWorldPos = wp.xyz;
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const metalFragmentShader = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform float uEdgeGlow;

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);

    // Key light from upper-right
    vec3 L1 = normalize(vec3(1.0, 2.0, 1.5));
    float NdotL1 = max(dot(N, L1), 0.0);

    // Fill light from camera direction
    vec3 L2 = V;
    float NdotL2 = max(dot(N, L2), 0.0);

    // Specular (gold highlights)
    vec3 H = normalize(L1 + V);
    float NdotH = max(dot(N, H), 0.0);
    float spec = pow(NdotH, 48.0) * 0.9;
    vec3 specColor = vec3(0.92, 0.78, 0.40) * spec;

    // Fresnel edge glow -- gold-white proportional to convergence speed
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.5);
    vec3 fresnelColor = mix(vec3(0.94, 0.88, 0.50), vec3(1.0, 0.95, 0.85), fresnel) * fresnel * uEdgeGlow;

    // Metallic diffuse with fill light
    vec3 diffuse = uBaseColor * (NdotL1 * 0.5 + NdotL2 * 0.2 + 0.15);

    vec3 color = diffuse + specColor + fresnelColor;

    gl_FragColor = vec4(color, 0.95);
  }
`;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface FragmentData {
  targetPos: THREE.Vector3;
  targetQuat: THREE.Quaternion;
  scatterPos: THREE.Vector3;
  scatterQuat: THREE.Quaternion;
  assemblyDelay: number;
}

export function HelixStrands({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const BOX_COUNT = isMobile ? 40 : 80;
  const CYL_COUNT = isMobile ? 25 : 50;
  const TORUS_COUNT = isMobile ? 15 : 30;

  const boxRef = useRef<THREE.InstancedMesh>(null);
  const cylRef = useRef<THREE.InstancedMesh>(null);
  const torusRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const { boxData, cylData, torusData, boxMat, cylMat, torusMat } = useMemo(() => {
    const rand = seededRandom(42);

    const generateFragments = (count: number, type: 'box' | 'cyl' | 'torus'): FragmentData[] => {
      const fragments: FragmentData[] = [];
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const angle = t * Math.PI * 2 * HELIX_TURNS;
        const strandOffset = (i % 2 === 0) ? 0 : Math.PI;
        const y = (t - 0.5) * HELIX_HEIGHT;

        let targetPos: THREE.Vector3;
        if (type === 'box') {
          targetPos = new THREE.Vector3(
            Math.cos(angle + strandOffset) * HELIX_RADIUS,
            y,
            Math.sin(angle + strandOffset) * HELIX_RADIUS
          );
        } else if (type === 'cyl') {
          const rungAngle = (i / count) * Math.PI * 2 * HELIX_TURNS;
          targetPos = new THREE.Vector3(
            Math.cos(rungAngle) * (HELIX_RADIUS * 0.6),
            (t - 0.5) * HELIX_HEIGHT,
            Math.sin(rungAngle) * (HELIX_RADIUS * 0.6)
          );
        } else {
          targetPos = new THREE.Vector3(
            Math.cos(angle) * (HELIX_RADIUS * 0.3),
            y,
            Math.sin(angle) * (HELIX_RADIUS * 0.3)
          );
        }

        const targetQuat = new THREE.Quaternion();
        targetQuat.setFromAxisAngle(
          new THREE.Vector3(rand(), rand(), rand()).normalize(),
          rand() * Math.PI
        );

        // Scatter to 3-6 units radius -- inside camera orbit at 12
        const phi = rand() * Math.PI * 2;
        const theta = Math.acos(2 * rand() - 1);
        const r = 3 + rand() * 3;
        const scatterPos = new THREE.Vector3(
          r * Math.sin(theta) * Math.cos(phi),
          r * Math.sin(theta) * Math.sin(phi),
          r * Math.cos(theta)
        );

        const scatterQuat = new THREE.Quaternion();
        scatterQuat.setFromAxisAngle(
          new THREE.Vector3(rand(), rand(), rand()).normalize(),
          rand() * Math.PI * 2
        );

        const distFromCenter = targetPos.length();
        const assemblyDelay = Math.min(1, distFromCenter / (HELIX_RADIUS * 1.2)) * 0.35;

        fragments.push({ targetPos, targetQuat, scatterPos, scatterQuat, assemblyDelay });
      }
      return fragments;
    };

    const bData = generateFragments(BOX_COUNT, 'box');
    const cData = generateFragments(CYL_COUNT, 'cyl');
    const tData = generateFragments(TORUS_COUNT, 'torus');

    // Silver-steel boxes
    const bMat = new THREE.ShaderMaterial({
      vertexShader: metalVertexShader,
      fragmentShader: metalFragmentShader,
      uniforms: {
        uBaseColor: { value: new THREE.Color(0.6, 0.6, 0.65) },
        uEdgeGlow: { value: 0 },
      },
      transparent: true,
    });

    // Warm bronze cylinders
    const cMat = new THREE.ShaderMaterial({
      vertexShader: metalVertexShader,
      fragmentShader: metalFragmentShader,
      uniforms: {
        uBaseColor: { value: new THREE.Color(0.7, 0.6, 0.45) },
        uEdgeGlow: { value: 0 },
      },
      transparent: true,
    });

    // Gold torus rings
    const tMat = new THREE.ShaderMaterial({
      vertexShader: metalVertexShader,
      fragmentShader: metalFragmentShader,
      uniforms: {
        uBaseColor: { value: new THREE.Color(0.92, 0.78, 0.40) },
        uEdgeGlow: { value: 0 },
      },
      transparent: true,
    });

    return { boxData: bData, cylData: cData, torusData: tData, boxMat: bMat, cylMat: cMat, torusMat: tMat };
  }, [BOX_COUNT, CYL_COUNT, TORUS_COUNT]);

  useFrame((_, delta) => {
    if (!boxRef.current || !cylRef.current || !torusRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.54) / 0.15));
    const coalesce = sceneP * sceneP * (3 - 2 * sceneP);

    // Edge glow peaks at mid-assembly
    const edgeGlow = Math.max(0, Math.sin(sceneP * Math.PI)) * 1.8;
    for (const mat of [boxMat, cylMat, torusMat]) {
      (mat.uniforms.uEdgeGlow as { value: number }).value = edgeGlow;
    }

    const rotAngle = coalesce > 0.8 ? t * 0.15 : t * 0.25 * (1 - coalesce);

    const updateInstances = (
      mesh: THREE.InstancedMesh,
      data: FragmentData[],
      count: number
    ) => {
      for (let i = 0; i < count; i++) {
        const d = data[i];
        const localP = Math.max(0, Math.min(1, (coalesce - d.assemblyDelay) / (1 - d.assemblyDelay + 0.001)));
        const smooth = localP * localP * (3 - 2 * localP);

        dummy.position.lerpVectors(d.scatterPos, d.targetPos, smooth);

        // Chaotic orbit when scattered
        if (smooth < 0.9) {
          const orbitSpeed = (1 - smooth) * 1.5;
          dummy.position.x += Math.sin(t * orbitSpeed + i * 1.3) * (1 - smooth) * 2;
          dummy.position.y += Math.cos(t * orbitSpeed * 0.7 + i * 2.1) * (1 - smooth) * 1.5;
          dummy.position.z += Math.sin(t * orbitSpeed * 0.5 + i * 0.9) * (1 - smooth) * 1.8;
        }

        dummy.quaternion.slerpQuaternions(d.scatterQuat, d.targetQuat, smooth);

        // After assembly: unified rotation
        if (smooth > 0.8) {
          const pos = dummy.position.clone();
          pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotAngle);
          dummy.position.copy(pos);
          dummy.quaternion.premultiply(
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotAngle)
          );
        }

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };

    updateInstances(boxRef.current, boxData, BOX_COUNT);
    updateInstances(cylRef.current, cylData, CYL_COUNT);
    updateInstances(torusRef.current, torusData, TORUS_COUNT);
  });

  return (
    <>
      <instancedMesh ref={boxRef} args={[undefined, boxMat, BOX_COUNT]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.7, 0.7]} />
      </instancedMesh>
      <instancedMesh ref={cylRef} args={[undefined, cylMat, CYL_COUNT]} castShadow receiveShadow>
        <cylinderGeometry args={[0.15, 0.15, 1.2, 8]} />
      </instancedMesh>
      <instancedMesh ref={torusRef} args={[undefined, torusMat, TORUS_COUNT]} castShadow receiveShadow>
        <torusGeometry args={[0.5, 0.12, 8, 24]} />
      </instancedMesh>
    </>
  );
}

export function HelixRungs({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const spineRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  const spineGeo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = isMobile ? 60 : 120;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = t * Math.PI * 2 * HELIX_TURNS;
      const y = (t - 0.5) * HELIX_HEIGHT;
      pts.push(new THREE.Vector3(
        Math.cos(angle) * 0.2,
        y,
        Math.sin(angle) * 0.2
      ));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false);
    return new THREE.TubeGeometry(curve, isMobile ? 50 : 100, 0.12, 8, false);
  }, [isMobile]);

  useFrame((_, delta) => {
    if (!spineRef.current) return;
    timeRef.current += delta;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.54) / 0.15));
    const spineP = Math.max(0, (sceneP - 0.5) / 0.5);

    const mat = spineRef.current.material as THREE.MeshPhysicalMaterial;
    mat.opacity = spineP * 0.85;
    mat.emissiveIntensity = spineP * 0.5;

    if (sceneP > 0.8) {
      spineRef.current.rotation.y = timeRef.current * 0.15;
    }
  });

  return (
    <mesh ref={spineRef} geometry={spineGeo}>
      <meshPhysicalMaterial
        color="#999999"
        emissive="#c9a84c"
        emissiveIntensity={0}
        metalness={0.7}
        roughness={0.3}
        transparent
        opacity={0}
      />
    </mesh>
  );
}

export function ConvergenceBackdrop({ progress }: { progress: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const neuralTex = useMemo(() => {
    const tex = new THREE.TextureLoader().load("/textures/neural-fiber.jpg");
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.55) / 0.15));
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = sceneP * 0.25;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -10]} scale={[30, 20, 1]}>
      <planeGeometry />
      <meshBasicMaterial
        map={neuralTex}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

export function HelixLighting() {
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[5, 10, 8]}
        intensity={4}
        color="#e4dcc8"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <pointLight position={[6, 5, 6]} intensity={4} color="#c9a84c" distance={30} decay={2} />
      <pointLight position={[-6, -3, -6]} intensity={2.5} color="#4a7c59" distance={25} decay={2} />
      <pointLight position={[0, 0, 10]} intensity={2.5} color="#e4dcc8" distance={25} decay={2} />
      <pointLight position={[0, 8, 0]} intensity={2} color="#e2cc7a" distance={20} decay={2} />
    </>
  );
}
