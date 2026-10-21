import type { Material } from "three";

// Per-viewport cache: sharing across canvases would mix their line resolutions.
export function overlayMaterial<T extends Material>(cache: Map<string, Material>, key: string, create: () => T): T {
  const existing = cache.get(key);
  if (existing) return existing as T;
  const material = create(); material.userData.cached = true; cache.set(key, material);
  return material;
}
