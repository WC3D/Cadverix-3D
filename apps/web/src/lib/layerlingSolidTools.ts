// Lid construction adapted from henmedia/layerling lidTool.ts (AGPL-3.0).
import type { CrossSection, ManifoldToplevel, Mat4 } from "manifold-3d";
import type { ManifoldSolid } from "@/lib/manifoldSplit";
import type { CookieOptions, LidOptions, TextureImage, TextureOptions } from "@/lib/layerlingModifierTypes";

const SCENE_TO_UP: Mat4 = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1];
const UP_TO_SCENE: Mat4 = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];
type Disposable = { delete(): void };
export function polygonArea(loop: readonly (readonly number[])[]) {
  return loop.reduce((sum, p, i) => { const q = loop[(i + 1) % loop.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
}
function filled(runtime: ManifoldToplevel, section: CrossSection) {
  return new runtime.CrossSection(section.toPolygons().filter((loop) => polygonArea(loop) > 0), "Positive");
}

export function lidForSolid(runtime: ManifoldToplevel, body: ManifoldSolid, options: LidOptions) {
  const made: Disposable[] = [];
  const keep = <T extends Disposable>(value: T): T => { made.push(value); return value; };
  try {
    const up = keep(body.transform(SCENE_TO_UP)), box = up.boundingBox();
    const top = box.max[2], height = top - box.min[2];
    const section = keep(up.slice(top - Math.min(0.3, height * 0.02)));
    const outline = keep(filled(runtime, section)), opening = keep(outline.subtract(section));
    if (outline.area() < 1) throw new Error("No usable top outline found");
    if (options.type !== "flat" && opening.area() < 1) throw new Error("This body is closed at the top. Hollow it first, or choose a flat lid.");
    if (options.type !== "flat" && options.depth >= height) throw new Error("The lid lip is deeper than the body");
    const prism = (area: CrossSection, low: number, high: number) => keep(keep(area.extrude(high - low)).translate([0, 0, low]));
    const parts: ManifoldSolid[] = [];
    if (options.type === "flat") parts.push(prism(outline, top, top + options.thickness));
    else {
      const inner = keep(outline.offset(options.gap, "Round", 2, 48));
      const outer = keep(outline.offset(options.gap + options.wall, "Round", 2, 48));
      parts.push(prism(options.type === "plug" ? outline : outer, top, top + options.thickness));
      if (options.type !== "cap") {
        const lip = keep(opening.offset(-options.gap, "Round", 2, 48));
        if (lip.area() < 1) throw new Error("The clearance leaves no room for the lid lip");
        const inside = keep(opening.offset(-(options.gap + options.wall), "Round", 2, 48));
        parts.push(prism(inside.area() >= 1 ? keep(lip.subtract(inside)) : lip, top - options.depth, top));
      }
      if (options.type !== "plug") parts.push(prism(keep(outer.subtract(inner)), top - options.depth, top));
    }
    const lid = parts.length === 1 ? parts[0] : keep(runtime.Manifold.union(parts));
    if (lid.isEmpty()) throw new Error("Lid produced no geometry");
    const turned = keep(lid.transform([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1]));
    const b = turned.boundingBox();
    const placed = keep(turned.translate([box.max[0] + 10 - b.min[0], (box.min[1] + box.max[1] - b.min[1] - b.max[1]) / 2, box.min[2] - b.min[2]]));
    return placed.transform(UP_TO_SCENE);
  } finally { new Set(made).forEach((value) => value.delete()); }
}

export function cookieCutterForSolid(runtime: ManifoldToplevel, body: ManifoldSolid, o: CookieOptions) {
  const made: Disposable[] = [];
  const keep = <T extends Disposable>(value: T): T => { made.push(value); return value; };
  try {
    const up = keep(body.transform(SCENE_TO_UP)), box = up.boundingBox();
    const projection = keep(up.project()), outer = keep(filled(runtime, projection));
    if (outer.area() < 1) throw new Error("No closed footprint found for a cookie cutter");
    const base = o.inner ? projection : outer;
    const outside = keep(outer.offset(o.wall + o.rim, "Round", 2, 48));
    const parts: ManifoldSolid[] = [];
    const prism = (area: CrossSection, height: number, low = 0) => keep(keep(area.extrude(height)).translate([0, 0, low]));
    parts.push(prism(keep(outside.subtract(outer)), o.rimHeight));
    const wall = keep(keep(base.offset(o.wall, "Round", 2, 48)).subtract(base));
    const bevelHeight = o.edge > 0 && o.edge < o.wall ? Math.min(2, o.height / 3, o.wall - o.edge) : 0;
    const wallHeight = o.height - bevelHeight;
    // Keep inner walls below the cutting edge when they are used as an imprint.
    const outerWall = keep(keep(outer.offset(o.wall, "Round", 2, 48)).subtract(outer));
    parts.push(prism(outerWall, wallHeight));
    if (o.inner) {
      const innerWall = keep(wall.subtract(outerWall));
      if (innerWall.area() > 1e-9) parts.push(prism(innerWall, Math.max(0.4, o.height - o.imprint)));
    }
    if (bevelHeight) {
      // shortcut: eight closed terraces approximate the cutting bevel; use CAD lofts for a smooth analytic bevel.
      for (let i = 0; i < 8; i++) {
        const thickness = o.wall - (o.wall - o.edge) * (i + 1) / 8;
        const ring = keep(keep(outer.offset(thickness, "Round", 2, 48)).subtract(outer));
        parts.push(prism(ring, bevelHeight / 8 + 0.001, wallHeight + i * bevelHeight / 8));
      }
    }
    if (o.plate >= 0.4) parts.push(prism(outside, o.plate));
    else if (o.inner) {
      const holes = keep(outer.subtract(projection)), holeParts = holes.decompose(); made.push(...holeParts);
      for (const hole of holeParts) {
        const b = hole.bounds(), center: [number, number] = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2];
        const bOuter = outer.bounds(), reach = Math.hypot(bOuter.max[0] - bOuter.min[0], bOuter.max[1] - bOuter.min[1]) + o.wall;
        const bar = keep(runtime.CrossSection.square([2 * reach, o.bridge], true));
        const moved = keep(bar.translate(center));
        parts.push(prism(keep(moved.intersect(outside)), Math.min(o.bridgeHeight, o.height - o.imprint)));
      }
    }
    let result = keep(runtime.Manifold.union(parts));
    if (o.mirror) result = keep(result.mirror([1, 0, 0]));
    const resultBox = result.boundingBox();
    result = keep(result.translate([box.max[0] + 10 - resultBox.min[0], 0, box.min[2]]));
    const components = result.decompose(); made.push(...components);
    if (components.length !== 1) throw new Error("The outline has disconnected islands. Use a backing plate to connect them.");
    return result.transform(UP_TO_SCENE);
  } finally { new Set(made).forEach((value) => value.delete()); }
}

const fract = (x: number) => x - Math.floor(x);
const noise = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
const line = (x: number, width: number) => Math.max(0, 1 - Math.abs(fract(x + 0.5) - 0.5) * 2 / width);
export function textureValue(pattern: TextureOptions["pattern"], x: number, y: number, width: number) {
  const a = line(x, width), b = line(y, width);
  switch (pattern) {
    case "grooves": return a;
    case "knurl": return Math.max(line(x + y, width), line(x - y, width));
    case "bumps": return Math.max(0, 1 - Math.hypot(fract(x + 0.5) - 0.5, fract(y + 0.5) - 0.5) * 2 / width) ** 0.5;
    case "honeycomb": {
      const q = x * 2 / Math.sqrt(3), r = y - q / 2;
      return Math.max(line(q, width * 0.4) * line(r * 2, 1), line(r, width * 0.4), line(q + r, width * 0.4));
    }
    case "cells": {
      let first = Infinity, second = Infinity;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const u = Math.floor(x) + i, v = Math.floor(y) + j;
        const d = Math.hypot(x - u - noise(u, v), y - v - noise(v + 7, u));
        if (d < first) { second = first; first = d; } else second = Math.min(second, d);
      }
      return Math.max(0, 1 - (second - first) / (width * 0.3));
    }
    case "bricks": return Math.max(b, line(x / 2 + (Math.floor(y) % 2) / 2, width / 2));
    case "knit": return Math.max(line(x + Math.sin(y * Math.PI * 2) * 0.25, width), line(x - Math.sin(y * Math.PI * 2) * 0.25, width));
    case "rope": return (1 + Math.sin((x + y * 0.5) * 2 * Math.PI)) / 2;
    case "weave": return Math.floor(x) % 2 === Math.floor(y) % 2 ? a : b;
    case "carbon": return fract((Math.floor(x) + Math.floor(y)) / 4) < 0.5 ? a : b;
    case "bark": return line(x + Math.sin(y * 0.7) * 0.3 + Math.sin(y * 2.3) * 0.1, width);
    case "wood": return (1 + Math.sin((Math.hypot(x * 0.2, y) + Math.sin(x * 0.3) * 0.1) * Math.PI * 2)) / 2;
    case "grain": return noise(Math.floor(x * 5), Math.floor(y * 5));
    case "cracks": return textureValue("cells", x + Math.sin(y * 11) * 0.04, y + Math.sin(x * 13) * 0.04, width * 0.3);
    case "image": case "text": return 0;
  }
}

export function textureImageValue(image: TextureImage, u: number, v: number) {
  const x = fract(u) * (image.width - 1), y = (1 - fract(v)) * (image.height - 1);
  const left = Math.floor(x), top = Math.floor(y), right = Math.min(left + 1, image.width - 1), bottom = Math.min(top + 1, image.height - 1);
  const a = image.values[top * image.width + left] * (1 - (x - left)) + image.values[top * image.width + right] * (x - left);
  const b = image.values[bottom * image.width + left] * (1 - (x - left)) + image.values[bottom * image.width + right] * (x - left);
  return a * (1 - (y - top)) + b * (y - top);
}

export function textureSolid(runtime: ManifoldToplevel, body: ManifoldSolid, o: TextureOptions) {
  const made: ManifoldSolid[] = [];
  const keep = (value: ManifoldSolid) => { made.push(value); return value; };
  try {
    const step = o.spacing / (o.pattern === "image" || o.pattern === "text" ? 24 : 6);
    if (body.surfaceArea() / (step * step) * 6 > 250_000) throw new Error("Texture would exceed 250,000 triangles. Increase spacing or simplify the body.");
    const refined = keep(body.refineToLength(step));
    if (refined.numTri() > 250_000) throw new Error("Texture refinement exceeds 250,000 triangles");
    const mesh = refined.getMesh(), vertices = mesh.vertProperties, indices = mesh.triVerts, stride = mesh.numProp;
    const normals = new Float64Array(mesh.numVert * 3);
    for (let i = 0; i < indices.length; i += 3) {
      const ids = [indices[i], indices[i + 1], indices[i + 2]];
      const [a, b, c] = ids.map((id) => id * stride);
      const ux = vertices[b] - vertices[a], uy = vertices[b + 1] - vertices[a + 1], uz = vertices[b + 2] - vertices[a + 2];
      const vx = vertices[c] - vertices[a], vy = vertices[c + 1] - vertices[a + 1], vz = vertices[c + 2] - vertices[a + 2];
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      for (const id of ids) for (let k = 0; k < 3; k++) normals[id * 3 + k] += n[k];
    }
    const positions = new Float32Array(mesh.numVert * 3), bounds = refined.boundingBox();
    const radius = Math.max(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]) / 2;
    const circumference = 2 * Math.PI * radius, repeats = Math.max(1, Math.round(circumference / o.spacing));
    const cos = Math.cos(o.angle * Math.PI / 180), sin = Math.sin(o.angle * Math.PI / 180);
    const value = (u: number, v: number) => {
      const x = (u * cos - v * sin) / o.spacing, y = (u * sin + v * cos) / o.spacing;
      return o.image && (o.pattern === "image" || o.pattern === "text") ? textureImageValue(o.image, x, y) : textureValue(o.pattern, x, y, o.width);
    };
    for (let i = 0; i < mesh.numVert; i++) {
      const p = i * stride, x = vertices[p], y = vertices[p + 1], z = vertices[p + 2];
      const nx = normals[i * 3], ny = normals[i * 3 + 1], nz = normals[i * 3 + 2], length = Math.hypot(nx, ny, nz) || 1;
      let weight = o.bottom ? 1 : Math.min(1, Math.max(0, (y - bounds.min[1]) / Math.max(o.depth * 2, 0.2)));
      if (!o.top) weight *= Math.min(1, Math.max(0, (bounds.max[1] - y) / o.spacing));
      if (!o.bottom && ny / length < -0.5) weight = 0;
      let pattern: number;
      if (o.projection === "cylinder") {
        const angle = Math.atan2(z - (bounds.min[2] + bounds.max[2]) / 2, x - (bounds.min[0] + bounds.max[0]) / 2);
        pattern = value(angle * repeats * o.spacing / (2 * Math.PI), y);
      } else if (o.projection === "flat") pattern = value(x, z);
      else {
        const total = Math.abs(nx) + Math.abs(ny) + Math.abs(nz) || 1;
        pattern = (Math.abs(nx) * value(z, y) + Math.abs(ny) * value(x, z) + Math.abs(nz) * value(x, y)) / total;
      }
      const distance = o.depth * weight * (o.direction === "inward" ? -pattern : o.direction === "outward" ? pattern : pattern * 2 - 1);
      positions.set([x + nx / length * distance, y + ny / length * distance, z + nz / length * distance], i * 3);
    }
    const output = new runtime.Mesh({ numProp: 3, vertProperties: positions, triVerts: indices, tolerance: 1e-5 });
    output.merge();
    const result = runtime.Manifold.ofMesh(output);
    if (result.status() !== "NoError" || result.isEmpty()) { result.delete(); throw new Error("Texture did not produce a closed mesh; reduce depth"); }
    return result;
  } finally { new Set(made).forEach((value) => value.delete()); }
}
