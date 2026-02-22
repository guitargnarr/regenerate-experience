/**
 * Scene I: The Silence (0.03-0.18) -- "Buried Seed"
 * A single organic seed form in a dark void. Narrow spotlight from above.
 * The seed breathes, then cracks open revealing inner gold glow.
 * Custom ShaderMaterial with subsurface scattering approximation.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ---- Seed vertex shader ---- */
const seedVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uCrack;
  uniform float uBreathe;

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  varying float vDisplacement;

  // Simple 3D noise (hash-based)
  float hash(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec3(1,0,0));
    float c = hash(i + vec3(0,1,0));
    float d = hash(i + vec3(1,1,0));
    float e = hash(i + vec3(0,0,1));
    float ff = hash(i + vec3(1,0,1));
    float g = hash(i + vec3(0,1,1));
    float h = hash(i + vec3(1,1,1));
    return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y),
               mix(mix(e,ff,f.x), mix(g,h,f.x), f.y), f.z);
  }

  void main() {
    vec3 pos = position;
    vec3 norm = normal;

    // Breathing displacement
    float breatheDisp = sin(uTime * 0.8 + pos.y * 2.0) * 0.04 * uBreathe;
    pos += norm * breatheDisp;

    // Organic surface noise
    float surfNoise = noise3D(pos * 3.0 + uTime * 0.1) * 0.08;
    pos += norm * surfNoise;

    // Crack displacement -- vertices pull apart based on noise pattern
    float crackPattern = noise3D(pos * 4.0 + vec3(0.0, uTime * 0.05, 0.0));
    float crackMask = smoothstep(0.45, 0.55, crackPattern);
    float crackDisp = crackMask * uCrack * 0.4;
    pos += norm * crackDisp;

    vDisplacement = crackDisp;
    vNormal = normalize(normalMatrix * norm);
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    vViewDir = normalize(cameraPosition - worldPos.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

/* ---- Seed fragment shader ---- */
const seedFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uCrack;
  uniform float uInnerGlow;
  uniform vec3 uMossColor;
  uniform vec3 uGoldColor;

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  varying float vDisplacement;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);

    // Light from above (moonlight through soil)
    vec3 lightDir = normalize(vec3(0.1, 1.0, 0.3));
    float NdotL = max(dot(N, lightDir), 0.0);

    // Subsurface scattering approximation: light wraps around edges
    float wrap = max(0.0, dot(N, lightDir) * 0.5 + 0.5);
    float sss = pow(wrap, 2.0) * 0.6;

    // Fresnel rim glow in moss-green
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 rimColor = uMossColor * fresnel * 0.8;

    // Organic surface -- slightly brighter for visibility
    vec3 baseColor = vec3(0.08, 0.10, 0.07);
    vec3 diffuse = baseColor * (NdotL * 0.5 + 0.15);
    vec3 sssColor = uMossColor * sss * 0.4;

    // Inner gold emission through cracks
    float innerEmission = vDisplacement * uInnerGlow * 12.0;
    vec3 innerColor = uGoldColor * innerEmission;

    // Increasing gold glow before cracks fully open
    float preGlow = uInnerGlow * 0.5 * (1.0 - uCrack);
    vec3 preGlowColor = uGoldColor * preGlow * (0.5 + 0.5 * sin(uTime * 1.5));

    vec3 color = diffuse + sssColor + rimColor + innerColor + preGlowColor;

    // Overall scene fade
    float alpha = 0.95;

    gl_FragColor = vec4(color, alpha);
  }
`;

/* ---- Ground plane vertex shader ---- */
const groundVertexShader = /* glsl */ `
  uniform float uTime;

  varying vec2 vUv;
  varying float vDisp;

  float hash(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec3(1,0,0));
    float c = hash(i + vec3(0,1,0));
    float d = hash(i + vec3(1,1,0));
    float e = hash(i + vec3(0,0,1));
    float ff = hash(i + vec3(1,0,1));
    float g = hash(i + vec3(0,1,1));
    float h = hash(i + vec3(1,1,1));
    return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y),
               mix(mix(e,ff,f.x), mix(g,h,f.x), f.y), f.z);
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Simplex-like displacement for soil texture
    float n = noise3D(vec3(pos.x * 0.5, pos.z * 0.5, uTime * 0.02)) * 0.3;
    n += noise3D(vec3(pos.x * 1.5, pos.z * 1.5, uTime * 0.01)) * 0.1;
    pos.y += n;
    vDisp = n;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

/* ---- Ground plane fragment shader ---- */
const groundFragmentShader = /* glsl */ `
  uniform sampler2D uSoilTex;

  varying vec2 vUv;
  varying float vDisp;

  void main() {
    float dist = length(vUv - 0.5);
    float falloff = 1.0 - smoothstep(0.0, 0.5, dist);

    // Sample soil photo texture (tiled 2x)
    vec3 texColor = texture2D(uSoilTex, vUv * 2.0).rgb * 0.15;

    // Procedural soil
    vec3 soil = vec3(0.06, 0.07, 0.04) + falloff * vec3(0.04, 0.05, 0.03);
    soil += vDisp * vec3(0.04, 0.06, 0.03);

    // Blend: 60% texture, 40% procedural
    vec3 color = mix(soil, texColor, 0.6);

    float alpha = (1.0 - smoothstep(0.3, 0.5, dist)) * 0.85;
    gl_FragColor = vec4(color, alpha);
  }
`;

/* ---- Exported components ---- */

export function EmberCore({ progress }: { progress: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uCrack: { value: 0 },
    uBreathe: { value: 1.0 },
    uInnerGlow: { value: 0 },
    uMossColor: { value: new THREE.Color(0x4a7c59) },
    uGoldColor: { value: new THREE.Color(0xc9a84c) },
  }), []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.03) / 0.15));

    uniforms.uTime.value = timeRef.current;

    // 0-0.3: barely visible dark sphere
    // 0.3-0.6: gold inner glow increases
    // 0.6-1.0: vertices split showing inner gold light
    if (sceneP < 0.3) {
      uniforms.uBreathe.value = 0.3 + sceneP * 2.3;
      uniforms.uInnerGlow.value = sceneP * 0.3;
      uniforms.uCrack.value = 0;
    } else if (sceneP < 0.6) {
      const t = (sceneP - 0.3) / 0.3;
      uniforms.uBreathe.value = 1.0;
      uniforms.uInnerGlow.value = 0.1 + t * 0.6;
      uniforms.uCrack.value = t * 0.2;
    } else {
      const t = (sceneP - 0.6) / 0.4;
      uniforms.uBreathe.value = 1.0 - t * 0.3;
      uniforms.uInnerGlow.value = 0.7 + t * 0.3;
      uniforms.uCrack.value = 0.2 + t * 0.8;
    }

    // Gentle float
    meshRef.current.position.y = Math.sin(timeRef.current * 0.3) * 0.1;
    meshRef.current.rotation.y = timeRef.current * 0.05;
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1.5, 4]} />
      <shaderMaterial
        vertexShader={seedVertexShader}
        fragmentShader={seedFragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}

export function DustMotes({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const COUNT = isMobile ? 30 : 60;
  const meshRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  const { positions, basePositions } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const base = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2 + Math.random() * 4;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      base[i * 3] = x; base[i * 3 + 1] = y; base[i * 3 + 2] = z;
    }
    return { positions: pos, basePositions: base };
  }, [COUNT]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.03) / 0.15));

    const posAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = basePositions[i * 3] + Math.cos(t * 0.15 + i * 0.7) * 0.15;
      arr[i * 3 + 1] = basePositions[i * 3 + 1] + Math.sin(t * 0.2 + i * 1.1) * 0.25;
      arr[i * 3 + 2] = basePositions[i * 3 + 2] + Math.sin(t * 0.1 + i * 0.9) * 0.1;
    }
    posAttr.needsUpdate = true;

    const mat = meshRef.current.material as THREE.PointsMaterial;
    mat.opacity = sceneP * 0.35;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={isMobile ? 0.06 : 0.04}
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

export function GroundPlane({ progress: _progress }: { progress: number }) {
  const soilTex = useMemo(() => {
    const tex = new THREE.TextureLoader().load("/textures/soil-macro.jpg");
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSoilTex: { value: soilTex },
  }), [soilTex]);

  useFrame((_, delta) => {
    uniforms.uTime.value += delta;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
      <planeGeometry args={[20, 20, 64, 64]} />
      <shaderMaterial
        vertexShader={groundVertexShader}
        fragmentShader={groundFragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}

export function EmberLighting() {
  return (
    <>
      <ambientLight intensity={0.05} />
      {/* Narrow spotlight from above -- moonlight through soil */}
      <spotLight
        position={[0.2, 6, 0.5]}
        angle={0.3}
        penumbra={0.7}
        intensity={5}
        color="#e4dcc8"
        distance={18}
        decay={2}
      />
      <pointLight position={[0, 0, 0]} intensity={1.0} color="#c9a84c" distance={8} decay={2} />
      <pointLight position={[0, -2, 2]} intensity={0.4} color="#4a7c59" distance={10} decay={2} />
    </>
  );
}
