/**
 * HeroPlane: Cinematic photo dissolve opener.
 *
 * A full-screen photograph (aerial foggy forest) rendered on a WebGL plane.
 * As the user scrolls, the image warps, develops chromatic aberration,
 * and dissolves from center outward with a gold emissive edge.
 * The seed (EmberCore) is revealed behind -- "what was already happening."
 */

import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useTexture } from "@/hooks/useTexture";
import { SCENES } from "@/constants/timeline";

/* ---- Vertex shader: subtle breathing + noise warp ---- */
const heroVertexShader = /* glsl */ `
  uniform float uProgress;
  uniform float uTime;

  varying vec2 vUv;

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

    // Subtle breathing at rest
    float breathe = sin(uTime * 0.5 + uv.y * 2.0) * 0.008 * (1.0 - uProgress);
    pos.z += breathe;

    // Progressive warping as scroll begins
    float warp = noise3D(vec3(pos.xy * 2.0, uTime * 0.05));
    pos.z += warp * uProgress * 2.0;
    pos.x += warp * uProgress * 0.4;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

/* ---- Fragment shader: dissolve + chromatic aberration + gold edge ---- */
const heroFragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform float uProgress;
  uniform float uTime;

  varying vec2 vUv;

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
    // Chromatic aberration ramps with progress
    float aberration = uProgress * 0.025;
    float r = texture2D(uTexture, vUv + vec2(aberration, 0.0)).r;
    float g = texture2D(uTexture, vUv).g;
    float b = texture2D(uTexture, vUv - vec2(aberration, 0.0)).b;
    vec3 color = vec3(r, g, b);

    // Desaturated at rest, slightly re-saturating before dissolve
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    float saturation = 0.35 + uProgress * 0.25;
    color = mix(vec3(gray), color, saturation);

    // Darken overall to match the dark palette
    color *= 0.55;

    // Noise-based dissolve from center outward
    float noise = noise3D(vec3(vUv * 4.0, uTime * 0.08));
    float distFromCenter = length(vUv - 0.5) * 1.5;

    // Dissolve threshold: center dissolves first
    float threshold = uProgress * 2.0 - distFromCenter * 0.6;
    float dissolveMask = smoothstep(threshold, threshold + 0.08, noise);

    // Gold emissive edge at dissolve boundary
    float edgeBand = smoothstep(threshold - 0.02, threshold + 0.02, noise)
                   - smoothstep(threshold + 0.02, threshold + 0.08, noise);
    vec3 edgeColor = vec3(0.79, 0.66, 0.30) * edgeBand * 3.0;

    color = color * dissolveMask + edgeColor;

    float alpha = max(dissolveMask, edgeBand * 0.5);

    // Hard cutoff when fully dissolved
    alpha *= 1.0 - smoothstep(0.85, 1.0, uProgress);

    // Film grain
    float grain = fract(sin(dot(vUv * (uTime + 1.0), vec2(12.9898, 78.233))) * 43758.5453);
    color += (grain - 0.5) * 0.02 * (1.0 - uProgress);

    gl_FragColor = vec4(color, alpha);
  }
`;

export function HeroPlane({ progress }: { progress: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();
  const texture = useTexture("/textures/hero-forest.jpg");

  const uniforms = useMemo(() => ({
    uTexture: { value: texture },
    uProgress: { value: 0 },
    uTime: { value: 0 },
  }), [texture]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    // Map scroll 0.00-0.06 to shader progress 0-1
    const heroEnd = SCENES.TITLE.end;
    const heroP = Math.min(1, progress / heroEnd);
    uniforms.uProgress.value = heroP;
    uniforms.uTime.value = clock.elapsedTime;
  });

  // Unmount after dissolve complete
  if (progress > SCENES.TITLE.end + 0.04) return null;

  return (
    <mesh ref={meshRef} position={[0, 0, 5]} renderOrder={100}>
      <planeGeometry args={[viewport.width * 1.3, viewport.height * 1.3, 48, 48]} />
      <shaderMaterial
        vertexShader={heroVertexShader}
        fragmentShader={heroFragmentShader}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
