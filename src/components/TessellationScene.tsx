/**
 * Scene III: The Search (0.37-0.52) -- "Shifting Polyhedra"
 * Geometric solids float in space, continuously morphing between shapes.
 * Glass-like transmission material -- you see through them. They cluster,
 * separate, rotate, never settle. Searching for form.
 *
 * Custom shader: vertex interpolates between stored position sets,
 * fragment cycles between glass/metallic/matte material identities.
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

/* ---- Morphing polyhedra vertex shader ---- */
const morphVertexShader = /* glsl */ `
  attribute vec3 posA; // icosahedron positions
  attribute vec3 posB; // dodecahedron positions
  attribute vec3 posC; // octahedron positions

  uniform float uMorphAB;  // 0 = posA, 1 = posB
  uniform float uMorphBC;  // 0 = posB, 1 = posC
  uniform float uMorphPhase; // overall phase 0-2 (which transition)
  uniform float uTime;

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  varying float vFresnel;

  void main() {
    // Three-way morph based on phase
    vec3 morphed;
    if (uMorphPhase < 1.0) {
      morphed = mix(posA, posB, uMorphAB);
    } else {
      morphed = mix(posB, posC, uMorphBC);
    }

    // Slight organic wobble
    float wobble = sin(uTime * 1.8 + morphed.y * 5.0) * 0.035;
    morphed += normal * wobble;

    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(morphed, 1.0);
    vWorldPos = wp.xyz;
    vViewDir = normalize(cameraPosition - wp.xyz);
    vFresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);

    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

/* ---- Material-shifting fragment shader ---- */
const morphFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uMaterialPhase; // 0 = glass, 0.5 = metallic, 1 = matte
  uniform vec3 uBaseColor;
  uniform float uOpacity;
  uniform sampler2D uEnvTex;

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  varying float vFresnel;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    vec3 L = normalize(vec3(sin(uTime * 0.3), 1.5, cos(uTime * 0.2)));

    float NdotL = max(dot(N, L), 0.0);
    vec3 H = normalize(L + V);
    float NdotH = max(dot(N, H), 0.0);

    // Second light for fill
    vec3 L2 = normalize(vec3(-0.5, 0.3, 1.0));
    float NdotL2 = max(dot(N, L2), 0.0);

    // Ice fracture env map: normal-based UV lookup for crystalline reflection
    vec3 reflectDir = reflect(-V, N);
    vec2 envUv = reflectDir.xy * 0.5 + 0.5;
    vec3 envSample = texture2D(uEnvTex, envUv).rgb;

    // Glass phase: transparent + heavy fresnel + bright refractive look
    vec3 glassColor = uBaseColor * 0.4 + vec3(0.95, 0.97, 1.0) * vFresnel * 1.2;
    float glassAlpha = 0.2 + vFresnel * 0.7;
    float glassSpec = pow(NdotH, 128.0) * 1.8;
    // Blend ice fracture texture into glass phase
    float glassMix = smoothstep(0.5, 0.0, uMaterialPhase);
    glassColor += envSample * 0.25 * glassMix * (1.0 - vFresnel);
    // Internal refraction fake: color shift
    glassColor += vec3(0.1, 0.15, 0.2) * (1.0 - vFresnel) * 0.3;

    // Metallic phase: bright, sharp specular, gold highlights
    vec3 metalColor = uBaseColor * (NdotL * 0.6 + NdotL2 * 0.3 + 0.25);
    float metalSpec = pow(NdotH, 64.0) * 1.2;
    vec3 metalSpecColor = vec3(0.92, 0.78, 0.40);
    float metalAlpha = 0.9;
    // Metallic fresnel rim
    metalColor += vFresnel * metalSpecColor * 0.5;

    // Matte phase: warm diffuse, subsurface hint
    vec3 matteColor = uBaseColor * (NdotL * 0.5 + NdotL2 * 0.2 + 0.35);
    float sss = pow(max(0.0, dot(N, -L) * 0.5 + 0.5), 2.0) * 0.3;
    matteColor += vec3(0.8, 0.7, 0.5) * sss;
    float matteAlpha = 0.8;

    // Interpolate between phases
    vec3 color;
    float alpha;

    if (uMaterialPhase < 0.5) {
      float t = uMaterialPhase * 2.0;
      color = mix(glassColor + glassSpec * vec3(1.0), metalColor + metalSpec * metalSpecColor, t);
      alpha = mix(glassAlpha, metalAlpha, t);
    } else {
      float t = (uMaterialPhase - 0.5) * 2.0;
      color = mix(metalColor + metalSpec * metalSpecColor, matteColor, t);
      alpha = mix(metalAlpha, matteAlpha, t);
    }

    // Strong fresnel rim -- scene signature
    color += vFresnel * vec3(0.5, 0.55, 0.65) * 0.5;

    // Pulsing inner glow
    float innerPulse = sin(uTime * 1.5 + vWorldPos.y * 3.0) * 0.5 + 0.5;
    color += uBaseColor * innerPulse * 0.1;

    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`;

/* ---- Line shader for connections ---- */
const lineVertexShader = /* glsl */ `
  varying float vAlpha;
  attribute float alpha;

  void main() {
    vAlpha = alpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const lineFragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(0.8, 0.85, 0.9, vAlpha * uOpacity * 0.5);
  }
`;

// Generate vertex positions for different platonic shapes projected onto a sphere
function generateMorphTargets(radius: number, segments: number): {
  icoPositions: Float32Array;
  dodecPositions: Float32Array;
  octPositions: Float32Array;
} {
  const geo = new THREE.SphereGeometry(radius, segments, segments);
  const posAttr = geo.getAttribute('position');
  const count = posAttr.count;
  const ico = new Float32Array(count * 3);
  const dodec = new Float32Array(count * 3);
  const oct = new Float32Array(count * 3);

  const icoGeo = new THREE.IcosahedronGeometry(radius, 0);
  const dodecGeo = new THREE.DodecahedronGeometry(radius, 0);
  const octGeo = new THREE.OctahedronGeometry(radius, 0);

  const icoVerts = getUniqueVertices(icoGeo);
  const dodecVerts = getUniqueVertices(dodecGeo);
  const octVerts = getUniqueVertices(octGeo);

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    const dir = new THREE.Vector3(x, y, z).normalize();
    const icoTarget = nearestVertex(dir, icoVerts, radius);
    const dodecTarget = nearestVertex(dir, dodecVerts, radius);
    const octTarget = nearestVertex(dir, octVerts, radius);

    ico[i * 3] = icoTarget.x;
    ico[i * 3 + 1] = icoTarget.y;
    ico[i * 3 + 2] = icoTarget.z;

    dodec[i * 3] = dodecTarget.x;
    dodec[i * 3 + 1] = dodecTarget.y;
    dodec[i * 3 + 2] = dodecTarget.z;

    oct[i * 3] = octTarget.x;
    oct[i * 3 + 1] = octTarget.y;
    oct[i * 3 + 2] = octTarget.z;
  }

  geo.dispose();
  icoGeo.dispose();
  dodecGeo.dispose();
  octGeo.dispose();

  return { icoPositions: ico, dodecPositions: dodec, octPositions: oct };
}

function getUniqueVertices(geo: THREE.BufferGeometry): THREE.Vector3[] {
  const pos = geo.getAttribute('position');
  const verts: THREE.Vector3[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) {
      seen.add(key);
      verts.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
    }
  }
  return verts;
}

function nearestVertex(dir: THREE.Vector3, verts: THREE.Vector3[], radius: number): THREE.Vector3 {
  let best = verts[0];
  let bestDot = -Infinity;
  for (const v of verts) {
    const d = dir.dot(v.clone().normalize());
    if (d > bestDot) {
      bestDot = d;
      best = v;
    }
  }
  // Blend between sphere surface and platonic vertex for smoother morph
  return dir.clone().multiplyScalar(radius).lerp(best, 0.7);
}

interface PolyhedronState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  morphRate: number;
  materialRate: number;
  phase: number;
  color: THREE.Color;
}

export function VoronoiCells({ progress, isMobile }: { progress: number; isMobile: boolean }) {
  const POLY_COUNT = isMobile ? 8 : 12;
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<THREE.Mesh[]>([]);
  const lineRef = useRef<THREE.LineSegments>(null);
  const timeRef = useRef(0);

  const iceTex = useMemo(() => {
    const tex = new THREE.TextureLoader().load("/textures/ice-fracture.jpg");
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, []);

  const { polyStates, morphTargets, materials, lineGeo, lineUniforms } = useMemo(() => {
    const rand = seededRandom(31);
    const targets = generateMorphTargets(1.0, 16);

    const states: PolyhedronState[] = [];
    const mats: THREE.ShaderMaterial[] = [];

    // Cool color temperature palette
    const colors = [
      new THREE.Color(0.6, 0.7, 0.75),   // cool grey-blue
      new THREE.Color(0.7, 0.75, 0.65),   // sage
      new THREE.Color(0.55, 0.6, 0.7),    // steel blue
      new THREE.Color(0.65, 0.65, 0.55),  // warm grey
      new THREE.Color(0.75, 0.7, 0.6),    // cream-warm
    ];

    // Mobile: narrower X spread (portrait viewport), taller Y, tighter Z
    const spreadX = isMobile ? 5 : 10;
    const spreadY = isMobile ? 8 : 7;
    const spreadZ = isMobile ? 3 : 5;

    for (let i = 0; i < POLY_COUNT; i++) {
      states.push({
        position: new THREE.Vector3(
          (rand() - 0.5) * spreadX,
          (rand() - 0.5) * spreadY,
          (rand() - 0.5) * spreadZ
        ),
        velocity: new THREE.Vector3(
          (rand() - 0.5) * 0.6,
          (rand() - 0.5) * 0.6,
          (rand() - 0.5) * 0.3
        ),
        rotSpeed: new THREE.Vector3(
          (rand() - 0.5) * 1.4,
          (rand() - 0.5) * 1.4,
          (rand() - 0.5) * 0.7
        ),
        morphRate: 0.5 + rand() * 1.0,
        materialRate: 0.35 + rand() * 0.7,
        phase: rand() * Math.PI * 2,
        color: colors[i % colors.length],
      });

      mats.push(new THREE.ShaderMaterial({
        vertexShader: morphVertexShader,
        fragmentShader: morphFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uMorphAB: { value: 0 },
          uMorphBC: { value: 0 },
          uMorphPhase: { value: 0 },
          uMaterialPhase: { value: 0 },
          uBaseColor: { value: colors[i % colors.length] },
          uOpacity: { value: 0 },
          uEnvTex: { value: iceTex },
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }));
    }

    // Connection lines geometry
    const maxLines = POLY_COUNT * POLY_COUNT;
    const lPositions = new Float32Array(maxLines * 6);
    const lAlphas = new Float32Array(maxLines * 2);
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute('position', new THREE.BufferAttribute(lPositions, 3));
    lGeo.setAttribute('alpha', new THREE.BufferAttribute(lAlphas, 1));

    const lUniforms = { uOpacity: { value: 0 } };

    return { polyStates: states, morphTargets: targets, materials: mats, lineGeo: lGeo, lineUniforms: lUniforms };
  }, [POLY_COUNT, isMobile, iceTex]);

  // Build geometries with morph target attributes
  const geos = useMemo(() => {
    return Array.from({ length: POLY_COUNT }).map(() => {
      const geo = new THREE.SphereGeometry(1.0, 16, 16);
      geo.setAttribute('posA', new THREE.BufferAttribute(morphTargets.icoPositions.slice(), 3));
      geo.setAttribute('posB', new THREE.BufferAttribute(morphTargets.dodecPositions.slice(), 3));
      geo.setAttribute('posC', new THREE.BufferAttribute(morphTargets.octPositions.slice(), 3));
      return geo;
    });
  }, [POLY_COUNT, morphTargets]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const sceneP = Math.max(0, Math.min(1, (progress - 0.37) / 0.15));

    // Update each polyhedron
    for (let i = 0; i < POLY_COUNT; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      const state = polyStates[i];
      const mat = materials[i];

      // Drift -- faster for drama
      state.position.add(state.velocity.clone().multiplyScalar(delta * 0.5));

      // Bounce off bounds (responsive to viewport)
      const boundsX = isMobile ? 3.5 : 6;
      const boundsY = isMobile ? 5 : 5;
      if (Math.abs(state.position.x) > boundsX) state.velocity.x *= -0.8;
      if (Math.abs(state.position.y) > boundsY) state.velocity.y *= -0.8;
      if (Math.abs(state.position.z) > 4) state.velocity.z *= -0.8;

      mesh.position.copy(state.position);
      mesh.rotation.x += state.rotSpeed.x * delta;
      mesh.rotation.y += state.rotSpeed.y * delta;
      mesh.rotation.z += state.rotSpeed.z * delta;

      // Morph phase: cycles through shape transitions
      const morphCycle = ((t * state.morphRate + state.phase) % 4);
      if (morphCycle < 1) {
        // A -> B transition
        (mat.uniforms.uMorphPhase as { value: number }).value = 0;
        (mat.uniforms.uMorphAB as { value: number }).value = morphCycle;
      } else if (morphCycle < 2) {
        // Hold B
        (mat.uniforms.uMorphPhase as { value: number }).value = 0;
        (mat.uniforms.uMorphAB as { value: number }).value = 1;
      } else if (morphCycle < 3) {
        // B -> C transition
        (mat.uniforms.uMorphPhase as { value: number }).value = 1;
        (mat.uniforms.uMorphBC as { value: number }).value = morphCycle - 2;
      } else {
        // C -> A transition (back to start)
        (mat.uniforms.uMorphPhase as { value: number }).value = 0;
        (mat.uniforms.uMorphAB as { value: number }).value = 1 - (morphCycle - 3);
      }

      // Material phase: cycles glass -> metallic -> matte
      const matPhase = ((t * state.materialRate + state.phase * 0.7) % 2);
      (mat.uniforms.uMaterialPhase as { value: number }).value = matPhase < 1 ? matPhase : 2 - matPhase;

      (mat.uniforms.uTime as { value: number }).value = t;
      (mat.uniforms.uOpacity as { value: number }).value = sceneP;
    }

    // Update connection lines
    if (lineRef.current) {
      const posArr = lineGeo.attributes.position.array as Float32Array;
      const alphaArr = lineGeo.attributes.alpha.array as Float32Array;
      let lineIdx = 0;
      const connectionDist = 5.0;

      for (let i = 0; i < POLY_COUNT; i++) {
        for (let j = i + 1; j < POLY_COUNT; j++) {
          const dist = polyStates[i].position.distanceTo(polyStates[j].position);
          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * sceneP;
            posArr[lineIdx * 6] = polyStates[i].position.x;
            posArr[lineIdx * 6 + 1] = polyStates[i].position.y;
            posArr[lineIdx * 6 + 2] = polyStates[i].position.z;
            posArr[lineIdx * 6 + 3] = polyStates[j].position.x;
            posArr[lineIdx * 6 + 4] = polyStates[j].position.y;
            posArr[lineIdx * 6 + 5] = polyStates[j].position.z;
            alphaArr[lineIdx * 2] = alpha;
            alphaArr[lineIdx * 2 + 1] = alpha;
            lineIdx++;
          }
        }
      }

      // Hide unused lines
      for (let i = lineIdx; i < POLY_COUNT * POLY_COUNT; i++) {
        alphaArr[i * 2] = 0;
        alphaArr[i * 2 + 1] = 0;
      }

      lineGeo.setDrawRange(0, lineIdx * 2);
      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.attributes.alpha.needsUpdate = true;
      lineUniforms.uOpacity.value = sceneP;
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: POLY_COUNT }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) meshRefs.current[i] = el; }}
          geometry={geos[i]}
          material={materials[i]}
        />
      ))}
      <lineSegments ref={lineRef} geometry={lineGeo}>
        <shaderMaterial
          vertexShader={lineVertexShader}
          fragmentShader={lineFragmentShader}
          uniforms={lineUniforms}
          transparent
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

export function TessellationLighting() {
  const spotRef = useRef<THREE.SpotLight>(null);
  const goldRef = useRef<THREE.PointLight>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    // Sweeping spotlight
    if (spotRef.current) {
      spotRef.current.position.x = Math.sin(t * 0.3) * 5;
      spotRef.current.position.z = Math.cos(t * 0.3) * 5;
    }
    // Orbiting gold point light
    if (goldRef.current) {
      goldRef.current.position.x = Math.sin(t * 0.5) * 4;
      goldRef.current.position.y = Math.cos(t * 0.3) * 2;
      goldRef.current.position.z = Math.cos(t * 0.5) * 4;
    }
  });

  return (
    <>
      <ambientLight intensity={0.2} />
      <spotLight
        ref={spotRef}
        position={[3, 6, 6]}
        angle={0.8}
        penumbra={0.7}
        intensity={5}
        color="#e4dcc8"
        distance={30}
        decay={2}
      />
      <pointLight ref={goldRef} position={[3, 1, 2]} intensity={2.5} color="#c9a84c" distance={22} decay={2} />
      <pointLight position={[-5, -2, 3]} intensity={1.5} color="#b0c4d6" distance={20} decay={2} />
      <hemisphereLight args={["#b0c4d6", "#2a3a28", 0.7]} />
    </>
  );
}
