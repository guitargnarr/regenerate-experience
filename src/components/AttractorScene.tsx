/**
 * Scene V: The Spark (0.71-0.86) -- "Ignition Bloom"
 * Lorenz attractor as a glowing tube mesh. Ember spheres race along it with trails.
 * At 60% -- IGNITION. Central star explodes with light. Bloom engulfs everything.
 * The only scene that goes from dark to bright.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Lorenz system parameters
const SIGMA = 10;
const RHO = 28;
const BETA = 8 / 3;
const DT = 0.005;
const SCALE = 0.22;

const lorenzCache = new Map<number, THREE.Vector3[]>();

function integrateLorenz(steps: number): THREE.Vector3[] {
  const cached = lorenzCache.get(steps);
  if (cached) return cached;

  const points: THREE.Vector3[] = [];
  let x = 0.1, y = 0, z = 0;
  for (let i = 0; i < steps; i++) {
    const dx = SIGMA * (y - x);
    const dy = x * (RHO - z) - y;
    const dz = x * y - BETA * z;
    x += dx * DT;
    y += dy * DT;
    z += dz * DT;
    points.push(new THREE.Vector3(x * SCALE, (z - 25) * SCALE, y * SCALE));
  }
  lorenzCache.set(steps, points);
  return points;
}

/* ---- Tube shader (energy pulse + ignition) ---- */
const tubeVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const tubeFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSceneP;
  uniform float uIgnition;
  uniform vec3 uMossColor;
  uniform vec3 uGoldColor;
  uniform vec3 uCreamColor;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    float t = vUv.x; // along tube length

    // Gradient: moss -> gold -> cream along path
    vec3 baseColor;
    if (t < 0.33) {
      baseColor = mix(uMossColor, uGoldColor, t / 0.33);
    } else if (t < 0.66) {
      baseColor = mix(uGoldColor, uCreamColor, (t - 0.33) / 0.33);
    } else {
      baseColor = uCreamColor;
    }

    // Energy pulse wave along tube
    float pulse = sin(t * 30.0 - uTime * 3.0) * 0.5 + 0.5;
    pulse *= 0.3 * uSceneP;

    // Fresnel edge glow
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 2.0);

    // Base emission: subdued pre-ignition, ramping up
    float emission = 0.3 + uSceneP * 0.4 + pulse;

    // Ignition: everything goes emissive
    emission = mix(emission, 2.5, uIgnition);
    baseColor = mix(baseColor, uCreamColor * 1.2, uIgnition * 0.6);

    vec3 color = baseColor * emission + fresnel * uGoldColor * 0.3;

    // Draw range fade: tube draws progressively
    float alpha = smoothstep(0.0, 0.02, uSceneP - t * 0.7) * 0.9;

    gl_FragColor = vec4(color, alpha);
  }
`;

export function AttractorPath({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const PATH_POINTS = isMobile ? 4000 : 8000;
  const groupRef = useRef<THREE.Group>(null);
  const tubeRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  const { tubeGeo, uniforms } = useMemo(() => {
    const points = integrateLorenz(PATH_POINTS);
    // Subsample for CatmullRom curve (every 8th point)
    const curvePoints: THREE.Vector3[] = [];
    const step = Math.max(1, Math.floor(PATH_POINTS / (isMobile ? 500 : 1000)));
    for (let i = 0; i < points.length; i += step) {
      curvePoints.push(points[i]);
    }
    const curve = new THREE.CatmullRomCurve3(curvePoints, false);
    const geo = new THREE.TubeGeometry(curve, isMobile ? 400 : 800, 0.06, 8, false);

    const u = {
      uTime: { value: 0 },
      uSceneP: { value: 0 },
      uIgnition: { value: 0 },
      uMossColor: { value: new THREE.Color(0x4a7c59) },
      uGoldColor: { value: new THREE.Color(0xc9a84c) },
      uCreamColor: { value: new THREE.Color(0xe4dcc8) },
    };

    return { tubeGeo: geo, uniforms: u };
  }, [PATH_POINTS, isMobile]);

  useFrame((_, delta) => {
    if (!tubeRef.current || !groupRef.current) return;
    timeRef.current += delta;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.71) / 0.15));

    uniforms.uTime.value = timeRef.current;
    uniforms.uSceneP.value = sceneP;

    // Ignition at 60% through scene
    const ignitionP = Math.max(0, (sceneP - 0.6) / 0.4);
    uniforms.uIgnition.value = ignitionP * ignitionP * (3 - 2 * ignitionP);

    // Progressive tube reveal via draw range
    const totalIndex = tubeGeo.index ? tubeGeo.index.count : tubeGeo.attributes.position.count;
    const visible = Math.floor(sceneP * 1.4 * totalIndex); // 1.4 so full tube visible by ~70%
    tubeGeo.setDrawRange(0, Math.min(visible, totalIndex));

    groupRef.current.rotation.y = timeRef.current * 0.05;
  });

  return (
    <group ref={groupRef}>
      <mesh ref={tubeRef} geometry={tubeGeo}>
        <shaderMaterial
          vertexShader={tubeVertexShader}
          fragmentShader={tubeFragmentShader}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export function SparkParticles({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const SPARK_COUNT = isMobile ? 20 : 40;
  const TRAIL_COUNT = isMobile ? 80 : 200;
  const PATH_POINTS = isMobile ? 4000 : 8000;

  const sparkRef = useRef<THREE.InstancedMesh>(null);
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);

  const { pathData, sparkMat, trailMat } = useMemo(() => {
    const points = integrateLorenz(PATH_POINTS);
    const flat = new Float32Array(PATH_POINTS * 3);
    for (let i = 0; i < PATH_POINTS; i++) {
      flat[i * 3] = points[i].x;
      flat[i * 3 + 1] = points[i].y;
      flat[i * 3 + 2] = points[i].z;
    }

    const sMat = new THREE.MeshStandardMaterial({
      color: 0xe2cc7a,
      emissive: 0xe2cc7a,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.9,
    });

    const tMat = new THREE.MeshStandardMaterial({
      color: 0xc9a84c,
      emissive: 0xc9a84c,
      emissiveIntensity: 1,
      transparent: true,
      opacity: 0.4,
    });

    return { pathData: flat, sparkMat: sMat, trailMat: tMat };
  }, [PATH_POINTS]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    if (!sparkRef.current || !trailRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.71) / 0.15));
    const visiblePath = Math.floor(sceneP * PATH_POINTS);
    if (visiblePath < 2) return;

    const ignitionP = Math.max(0, (sceneP - 0.6) / 0.4);
    const smoothIgnition = ignitionP * ignitionP * (3 - 2 * ignitionP);

    sparkMat.emissiveIntensity = 2 + smoothIgnition * 4;
    sparkMat.opacity = Math.min(1, sceneP * 1.5);
    trailMat.emissiveIntensity = 1 + smoothIgnition * 3;
    trailMat.opacity = Math.min(0.6, sceneP * 0.8);

    // Racing sparks along the path
    for (let i = 0; i < SPARK_COUNT; i++) {
      const speed = 0.05 + (i / SPARK_COUNT) * 0.1;
      const pathIdx = Math.floor(((t * speed * 200 + i * (PATH_POINTS / SPARK_COUNT)) % visiblePath));
      const ci = Math.max(0, Math.min(pathIdx, PATH_POINTS - 1));

      dummy.position.set(pathData[ci * 3], pathData[ci * 3 + 1], pathData[ci * 3 + 2]);
      const sparkScale = 0.8 + Math.sin(t * 4 + i) * 0.3 + smoothIgnition * 0.5;
      dummy.scale.setScalar(sparkScale);
      dummy.updateMatrix();
      sparkRef.current.setMatrixAt(i, dummy.matrix);
    }
    sparkRef.current.instanceMatrix.needsUpdate = true;
    sparkRef.current.rotation.y = t * 0.05;

    // Trails: smaller spheres behind each spark
    for (let i = 0; i < TRAIL_COUNT; i++) {
      const sparkIdx = i % SPARK_COUNT;
      const trailOffset = Math.floor(i / SPARK_COUNT) * 15;
      const speed = 0.05 + (sparkIdx / SPARK_COUNT) * 0.1;
      const pathIdx = Math.floor(((t * speed * 200 + sparkIdx * (PATH_POINTS / SPARK_COUNT) - trailOffset) % visiblePath));
      const ci = Math.max(0, Math.min(Math.abs(pathIdx), PATH_POINTS - 1));

      dummy.position.set(pathData[ci * 3], pathData[ci * 3 + 1], pathData[ci * 3 + 2]);
      dummy.scale.setScalar(0.4 - (trailOffset / 80) * 0.2);
      dummy.updateMatrix();
      trailRef.current.setMatrixAt(i, dummy.matrix);
    }
    trailRef.current.instanceMatrix.needsUpdate = true;
    trailRef.current.rotation.y = t * 0.05;
  });

  return (
    <>
      <instancedMesh ref={sparkRef} args={[undefined, undefined, SPARK_COUNT]} material={sparkMat}>
        <sphereGeometry args={[0.08, 8, 8]} />
      </instancedMesh>
      <instancedMesh ref={trailRef} args={[undefined, undefined, TRAIL_COUNT]} material={trailMat}>
        <sphereGeometry args={[0.03, 4, 4]} />
      </instancedMesh>
    </>
  );
}

export function CentralStar({ progress }: { progress: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.71) / 0.15));

    // Star appears at 40% through scene
    const starP = Math.max(0, (sceneP - 0.4) / 0.6);
    const ignitionP = Math.max(0, (sceneP - 0.6) / 0.4);
    const smoothIgnition = ignitionP * ignitionP * (3 - 2 * ignitionP);

    meshRef.current.visible = starP > 0;
    if (starP <= 0) return;

    const scale = 0.3 + starP * 0.4 + smoothIgnition * 0.8;
    meshRef.current.scale.setScalar(scale);

    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 1 + smoothIgnition * 6;
    mat.opacity = starP * 0.9;

    // Distort effect via vertex displacement using scale wobble
    const wobble = Math.sin(timeRef.current * 3) * 0.1 * smoothIgnition;
    meshRef.current.scale.x = scale + wobble;
    meshRef.current.scale.z = scale - wobble * 0.5;

    meshRef.current.rotation.x = timeRef.current * 0.3;
    meshRef.current.rotation.y = timeRef.current * 0.5;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <icosahedronGeometry args={[0.5, 3]} />
      <meshStandardMaterial
        color="#e2cc7a"
        emissive="#e4dcc8"
        emissiveIntensity={1}
        transparent
        opacity={0}
        roughness={0.2}
        metalness={0.3}
      />
    </mesh>
  );
}

export function RadialRays({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const RAY_COUNT = 8;
  const timeRef = useRef(0);

  const raysRef = useRef<THREE.Mesh[]>([]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.71) / 0.15));
    const ignitionP = Math.max(0, (sceneP - 0.6) / 0.4);
    const smoothIgnition = ignitionP * ignitionP * (3 - 2 * ignitionP);

    groupRef.current.visible = smoothIgnition > 0.01;
    if (!groupRef.current.visible) return;

    groupRef.current.rotation.z = timeRef.current * 0.1;

    for (let i = 0; i < raysRef.current.length; i++) {
      const ray = raysRef.current[i];
      if (!ray) continue;
      const mat = ray.material as THREE.MeshStandardMaterial;
      mat.opacity = smoothIgnition * 0.4;
      mat.emissiveIntensity = smoothIgnition * 3;
      ray.scale.y = smoothIgnition * 4;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {Array.from({ length: RAY_COUNT }).map((_, i) => {
        const angle = (i / RAY_COUNT) * Math.PI * 2;
        return (
          <mesh
            key={i}
            ref={(el) => { if (el) raysRef.current[i] = el; }}
            position={[Math.cos(angle) * 1.5, Math.sin(angle) * 1.5, 0]}
            rotation={[0, 0, angle + Math.PI / 2]}
          >
            <cylinderGeometry args={[0.02, 0.005, 3, 4]} />
            <meshStandardMaterial
              color="#e4dcc8"
              emissive="#e2cc7a"
              emissiveIntensity={0}
              transparent
              opacity={0}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export function AttractorGlow({ progress }: { progress: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.71) / 0.15));
    const ignitionP = Math.max(0, (sceneP - 0.6) / 0.4);

    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = sceneP * 0.5 + ignitionP * 2;
    mat.opacity = sceneP * 0.12 + ignitionP * 0.3;
    meshRef.current.scale.setScalar(4 + sceneP * 3 + ignitionP * 5);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 24, 24]} />
      <meshStandardMaterial
        color="#0a0d08"
        emissive="#c9a84c"
        emissiveIntensity={0}
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
      />
    </mesh>
  );
}

export function AttractorLighting({ progress }: { progress: number }) {
  const mainRef = useRef<THREE.PointLight>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.71) / 0.15));
    const ignitionP = Math.max(0, (sceneP - 0.6) / 0.4);
    const smoothIgnition = ignitionP * ignitionP * (3 - 2 * ignitionP);

    if (mainRef.current) {
      // Ramp light intensity during ignition: dark to blazing
      mainRef.current.intensity = 0.8 + smoothIgnition * 4;
    }
  });

  return (
    <>
      <ambientLight intensity={0.06} />
      <pointLight ref={mainRef} position={[0, 3, 5]} intensity={0.8} color="#c9a84c" distance={25} decay={2} />
      <pointLight position={[-3, -2, 3]} intensity={0.6} color="#4a7c59" distance={15} decay={2} />
      <pointLight position={[4, 1, -3]} intensity={0.4} color="#e4dcc8" distance={12} decay={2} />
    </>
  );
}
