import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const DEFAULT_ROUNDED_BOX_WIDTH = 40;
export const DEFAULT_ROUNDED_BOX_DEPTH = 30;
export const DEFAULT_ROUNDED_BOX_HEIGHT = 20;
export const DEFAULT_ROUNDED_BOX_CORNER_FILLET = 5;
export const DEFAULT_ROUNDED_BOX_TOP_BOTTOM_FILLET = 0;
export const DEFAULT_ROUNDED_BOX_QUALITY = 8;

export const MIN_ROUNDED_BOX_QUALITY = 4;
export const MAX_ROUNDED_BOX_QUALITY = 32;

export function normalizeCornerFillet(val: unknown, maxFillet = 50): number {
  const n = typeof val === "number" && Number.isFinite(val) ? val : DEFAULT_ROUNDED_BOX_CORNER_FILLET;
  return Math.max(0, Math.min(maxFillet, Math.round(n * 10) / 10));
}

export function normalizeTopBottomFillet(val: unknown, maxFillet = 50): number {
  const n = typeof val === "number" && Number.isFinite(val) ? val : DEFAULT_ROUNDED_BOX_TOP_BOTTOM_FILLET;
  return Math.max(0, Math.min(maxFillet, Math.round(n * 10) / 10));
}

export function normalizeRoundedBoxQuality(val: unknown): number {
  const n = typeof val === "number" && Number.isFinite(val) ? Math.round(val) : DEFAULT_ROUNDED_BOX_QUALITY;
  return Math.max(MIN_ROUNDED_BOX_QUALITY, Math.min(MAX_ROUNDED_BOX_QUALITY, n));
}

export type RoundedBoxGeometryOptions = {
  width: number;
  depth: number;
  height: number;
  cornerFillet?: number;
  topBottomFillet?: number;
  roundedBoxQuality?: number;
};

type Point2D = { x: number; z: number };

export function buildRoundedRectContour(
  width: number,
  depth: number,
  cornerFillet: number,
  quality: number,
): Point2D[] {
  const safeW = Math.max(0.01, width);
  const safeD = Math.max(0.01, depth);
  const maxR = Math.min(safeW / 2, safeD / 2);
  const r = Math.max(0, Math.min(maxR, cornerFillet));
  const q = Math.max(2, quality);

  if (r <= 1e-5) {
    const hw = safeW / 2;
    const hd = safeD / 2;
    return [
      { x: hw, z: -hd },
      { x: hw, z: hd },
      { x: -hw, z: hd },
      { x: -hw, z: -hd },
    ];
  }

  const cx = safeW / 2 - r;
  const cz = safeD / 2 - r;
  const pts: Point2D[] = [];

  for (let i = 0; i <= q; i += 1) {
    const a = (i / q) * (Math.PI / 2);
    pts.push({ x: cx + r * Math.cos(a), z: cz + r * Math.sin(a) });
  }
  for (let i = 0; i <= q; i += 1) {
    const a = Math.PI / 2 + (i / q) * (Math.PI / 2);
    pts.push({ x: -cx + r * Math.cos(a), z: cz + r * Math.sin(a) });
  }
  for (let i = 0; i <= q; i += 1) {
    const a = Math.PI + (i / q) * (Math.PI / 2);
    pts.push({ x: -cx + r * Math.cos(a), z: -cz + r * Math.sin(a) });
  }
  for (let i = 0; i <= q; i += 1) {
    const a = 1.5 * Math.PI + (i / q) * (Math.PI / 2);
    pts.push({ x: cx + r * Math.cos(a), z: -cz + r * Math.sin(a) });
  }

  const clean: Point2D[] = [];
  for (const curr of pts) {
    const prev = clean[clean.length - 1];
    if (!prev || Math.hypot(curr.x - prev.x, curr.z - prev.z) > 1e-5) clean.push(curr);
  }
  if (clean.length > 2) {
    const first = clean[0];
    const last = clean[clean.length - 1];
    if (Math.hypot(first.x - last.x, first.z - last.z) < 1e-5) clean.pop();
  }
  return clean;
}

function createExtrudedRoundedBox(
  width: number,
  depth: number,
  height: number,
  cornerFillet: number,
  quality: number,
): THREE.BufferGeometry {
  const contour = buildRoundedRectContour(width, depth, cornerFillet, quality);
  const shapeVecs = contour.map((p) => new THREE.Vector2(p.x, p.z));
  const triIndices = THREE.ShapeUtils.triangulateShape(shapeVecs, []);
  const vertices: number[] = [];

  for (const [i0, i1, i2] of triIndices) {
    const p0 = contour[i0];
    const p1 = contour[i1];
    const p2 = contour[i2];
    vertices.push(p0.x, 0, p0.z, p1.x, 0, p1.z, p2.x, 0, p2.z);
  }
  for (const [i0, i1, i2] of triIndices) {
    const p0 = contour[i0];
    const p1 = contour[i1];
    const p2 = contour[i2];
    vertices.push(p0.x, height, p0.z, p2.x, height, p2.z, p1.x, height, p1.z);
  }
  for (let i = 0; i < contour.length; i += 1) {
    const pi = contour[i];
    const pj = contour[(i + 1) % contour.length];
    vertices.push(
      pi.x, 0, pi.z,
      pj.x, height, pj.z,
      pj.x, 0, pj.z,
      pi.x, 0, pi.z,
      pi.x, height, pi.z,
      pj.x, height, pj.z,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  const creased = toCreasedNormals(geometry, THREE.MathUtils.degToRad(30));
  geometry.dispose();
  creased.computeBoundingBox();
  creased.computeBoundingSphere();
  return creased;
}

function createFullRoundedBox(
  width: number,
  depth: number,
  height: number,
  rc: number,
  rtb: number,
  q: number,
): THREE.BufferGeometry {
  const segX = q * 2 + 1;
  const segZ = q * 2 + 1;
  const segY = q * 2 + 1;
  const baseGeo = new THREE.BoxGeometry(1, 1, 1, segX, segY, segZ);
  const nonIndexed = baseGeo.toNonIndexed();
  baseGeo.dispose();
  const pos = nonIndexed.attributes.position.array;
  const innerX = width / 2 - rc;
  const innerY = height / 2 - rtb;
  const innerZ = depth / 2 - rc;
  const halfSegX = 0.5 / segX;
  const halfSegY = 0.5 / segY;
  const halfSegZ = 0.5 / segZ;
  const normal = new THREE.Vector3();
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.length; i += 3) {
    v.set(pos[i], pos[i + 1], pos[i + 2]);
    normal.copy(v);
    normal.x -= Math.sign(normal.x) * halfSegX;
    normal.y -= Math.sign(normal.y) * halfSegY;
    normal.z -= Math.sign(normal.z) * halfSegZ;
    normal.normalize();
    pos[i] = innerX * Math.sign(v.x) + normal.x * rc;
    pos[i + 1] = innerY * Math.sign(v.y) + normal.y * rtb + height / 2;
    pos[i + 2] = innerZ * Math.sign(v.z) + normal.z * rc;
  }

  nonIndexed.computeVertexNormals();
  const creased = toCreasedNormals(nonIndexed, THREE.MathUtils.degToRad(30));
  nonIndexed.dispose();
  creased.computeBoundingBox();
  creased.computeBoundingSphere();
  return creased;
}

export function createRoundedBoxGeometry({
  width,
  depth,
  height,
  cornerFillet = DEFAULT_ROUNDED_BOX_CORNER_FILLET,
  topBottomFillet = DEFAULT_ROUNDED_BOX_TOP_BOTTOM_FILLET,
  roundedBoxQuality = DEFAULT_ROUNDED_BOX_QUALITY,
}: RoundedBoxGeometryOptions): THREE.BufferGeometry {
  const safeW = Math.max(0.01, width);
  const safeD = Math.max(0.01, depth);
  const safeH = Math.max(0.01, height);
  const rc = Math.max(0, Math.min(Math.min(safeW / 2, safeD / 2), cornerFillet));
  const rtb = Math.max(0, Math.min(safeH / 2, topBottomFillet));
  const q = normalizeRoundedBoxQuality(roundedBoxQuality);
  return rtb <= 1e-4
    ? createExtrudedRoundedBox(safeW, safeD, safeH, rc, q)
    : createFullRoundedBox(safeW, safeD, safeH, rc, rtb, q);
}
