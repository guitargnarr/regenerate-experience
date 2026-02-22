/**
 * useTexture: Lightweight texture loading with global cache.
 * Uses raw THREE.TextureLoader -- no @react-three/drei dependency.
 */

import { useMemo } from "react";
import * as THREE from "three";

const textureCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();

interface TextureOptions {
  colorSpace?: THREE.ColorSpace;
  wrapS?: THREE.Wrapping;
  wrapT?: THREE.Wrapping;
}

export function useTexture(
  path: string,
  options: TextureOptions = {}
): THREE.Texture {
  return useMemo(() => {
    const cached = textureCache.get(path);
    if (cached) return cached;

    const tex = loader.load(path);
    tex.colorSpace = options.colorSpace ?? THREE.SRGBColorSpace;
    tex.wrapS = options.wrapS ?? THREE.ClampToEdgeWrapping;
    tex.wrapT = options.wrapT ?? THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;

    textureCache.set(path, tex);
    return tex;
  }, [path]);
}

/** Preload textures without blocking render */
export function preloadTextures(paths: string[]): void {
  for (const path of paths) {
    if (!textureCache.has(path)) {
      const tex = loader.load(path);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      textureCache.set(path, tex);
    }
  }
}
