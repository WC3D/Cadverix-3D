/** A conservative alternative to OCCT's edge chamfer builder for a faceted,
 * convex outer rim. Only a complete horizontal top loop containing the entire
 * upper band is accepted. The bevel distance/angle are measured on the top
 * plane; material below the band is untouched. */
type Point = { x: number; z: number };
const TOLERANCE = 0.0001;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);

export function planarRimChamferPlan(edges: readonly number[][], sourcePoints: readonly number[], amount: number, angle: number) {
  if (edges.length < 16 || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(angle) || angle < 5 || angle > 85) return null;
  const height = edges[0]?.[1];
  if (height === undefined) return null;
  const sides = edges.map((points) => {
    if (points.length !== 6 || !points.every(Number.isFinite) || Math.abs(points[1]! - height) > TOLERANCE || Math.abs(points[4]! - height) > TOLERANCE) return null;
    return [{ x: points[0]!, z: points[2]! }, { x: points[3]!, z: points[5]! }] as const;
  });
  if (sides.some((side) => !side)) return null;
  const remaining = sides.filter((side): side is NonNullable<typeof side> => side !== null);
  const first = remaining.shift()!;
  const loop: Point[] = [first[0]];
  let current = first[1];
  while (remaining.length) {
    loop.push(current);
    const matches = remaining.map((side, index) => ({ side, index })).filter(({ side }) => side.some((point) => distance(point, current) < TOLERANCE));
    if (matches.length !== 1) return null;
    const { side, index } = matches[0]!;
    current = distance(side[0], current) < TOLERANCE ? side[1] : side[0];
    remaining.splice(index, 1);
  }
  if (distance(current, loop[0]!) > TOLERANCE) return null;
  // STL triangulation can split a straight boundary edge into tiny pieces.
  for (let i = loop.length - 1; i >= 0 && loop.length > 3; i--) {
    const previous = loop[(i + loop.length - 1) % loop.length]!;
    const point = loop[i]!;
    const next = loop[(i + 1) % loop.length]!;
    if (Math.abs(cross(previous, next, point)) <= TOLERANCE * distance(previous, next)
      && distance(previous, point) + distance(point, next) <= distance(previous, next) + TOLERANCE) loop.splice(i, 1);
  }
  const area = loop.reduce((sum, a, i) => { const b = loop[(i + 1) % loop.length]!; return sum + a.x * b.z - b.x * a.z; }, 0);
  if (Math.abs(area) < TOLERANCE) return null;
  if (area < 0) loop.reverse();
  const inside = (point: Point, polygon = loop) => polygon.every((a, i) => { const b = polygon[(i + 1) % polygon.length]!; return cross(a, b, point) >= -TOLERANCE * distance(a, b); });
  if (!loop.every((point) => inside(point))) return null;
  const depth = amount * Math.tan(angle * Math.PI / 180);
  const bottom = height - depth;
  const padding = Math.max(0.01, amount * 0.01);
  const source: { x: number; y: number; z: number }[] = [];
  let fits = true;
  for (let i = 0; i + 2 < sourcePoints.length; i += 3) {
    const point = { x: sourcePoints[i]!, y: sourcePoints[i + 1]!, z: sourcePoints[i + 2]! };
    if (!Object.values(point).every(Number.isFinite)) return null;
    if (point.y > height + TOLERANCE || (Math.abs(point.y - height) < TOLERANCE && !inside(point))) return null;
    if (point.y >= bottom - TOLERANCE && !inside(point)) fits = false;
    source.push(point);
  }
  if (!source.some((point) => point.y < bottom - TOLERANCE)) fits = false;
  const inset = (offset: number) => loop.map((point, i) => {
    const previous = loop[(i + loop.length - 1) % loop.length]!;
    const next = loop[(i + 1) % loop.length]!;
    const lenA = distance(previous, point), lenB = distance(point, next);
    const a = { x: -(point.z - previous.z) / lenA, z: (point.x - previous.x) / lenA };
    const b = { x: -(next.z - point.z) / lenB, z: (next.x - point.x) / lenB };
    const factor = offset / (1 + a.x * b.x + a.z * b.z);
    return { x: point.x + (a.x + b.x) * factor, z: point.z + (a.z + b.z) * factor };
  });
  const offset = amount * (1 + padding / depth);
  const topLoop = inset(offset);
  // Every offset vertex must satisfy every inset half-plane. Simply checking
  // against the original polygon would accept an inset that folded inside out.
  if (!topLoop.every((point) => Number.isFinite(point.x) && Number.isFinite(point.z) && loop.every((a, i) => {
    const b = loop[(i + 1) % loop.length]!;
    return cross(a, b, point) >= (offset - TOLERANCE) * distance(a, b);
  }))) fits = false;
  return { loop, topLoop, bottom, top: height + padding, height, fits };
}

export type RimRoundProfile = {
  poles: number[];
  weights: number[];
  knots: number[];
  multiplicities: number[];
};

/** Radius-driven round-over of a faceted rim. In each wall's normal section,
 * the profile is a circle tangent to the top plane and the original wall. The
 * rational quadratic profiles retain those circles rather than substituting
 * a chamfer or a polygonal approximation of the radius. */
export function planarRimFilletPlan(edges: readonly number[][], sourceEdges: readonly number[][], radius: number, wallSlopes: readonly number[]) {
  if (wallSlopes.length !== edges.length || !wallSlopes.every(Number.isFinite)) return null;
  const base = planarRimChamferPlan(edges, sourceEdges.flat(), radius, 45);
  if (!base) return null;
  const { loop, height } = base;
  const normals = loop.map((a, i) => {
    const b = loop[(i + 1) % loop.length]!;
    const length = distance(a, b);
    return { x: -(b.z - a.z) / length, z: (b.x - a.x) / length };
  });
  // Collinear STL splits may have been merged by loop preparation. Match each
  // resulting side to the source wall plane, independent of edge direction.
  const slopes = loop.map((a, i) => {
    const b = loop[(i + 1) % loop.length]!;
    const matches = edges.map((edge, index) => ({ edge, index })).filter(({ edge }) => {
      const p = { x: (edge[0]! + edge[3]!) / 2, z: (edge[2]! + edge[5]!) / 2 };
      return Math.abs(cross(a, b, p)) <= TOLERANCE * distance(a, b) && distance(a, p) + distance(p, b) <= distance(a, b) + TOLERANCE;
    });
    return matches.length ? matches.reduce((sum, { index }) => sum + wallSlopes[index]!, 0) / matches.length : NaN;
  });
  if (!slopes.every(Number.isFinite)) return null;
  const centers = slopes.map((slope) => radius * (Math.sqrt(1 + slope * slope) + slope));
  const tangencies = slopes.map((slope) => -Math.atan(slope));
  const startAngle = Math.min(...tangencies);
  const bottom = height - radius + radius * Math.sin(startAngle);
  const pointAt = (index: number, angle: number) => {
    const depth = radius * (1 - Math.sin(angle));
    const offset = (side: number) => angle < tangencies[side]!
      ? slopes[side]! * depth
      : centers[side]! - radius * Math.cos(angle);
    const previous = (index + loop.length - 1) % loop.length;
    const a = normals[previous]!, b = normals[index]!;
    const dA = offset(previous), dB = offset(index);
    const determinant = a.x * b.z - a.z * b.x;
    return {
      x: loop[index]!.x + (dA * b.z - a.z * dB) / determinant,
      y: height - depth,
      z: loop[index]!.z + (a.x * dB - dA * b.x) / determinant,
    };
  };
  const bottomLoop = loop.map((_, i) => pointAt(i, startAngle));
  const topLoop = loop.map((_, i) => pointAt(i, Math.PI / 2));
  let fits = [...bottomLoop, ...topLoop].every((point) => Object.values(point).every(Number.isFinite));
  if (!topLoop.every((point) => loop.every((a, i) => (point.x - a.x) * normals[i]!.x + (point.z - a.z) * normals[i]!.z >= centers[i]! - TOLERANCE))) fits = false;
  // Check the original wall envelope throughout the band, including where
  // source edges cross its bottom. Checking only STL endpoints can miss an
  // expanding/sloping wall and leave a ledge at the bottom of the round-over.
  const inEnvelope = (x: number, y: number, z: number) => loop.every((a, i) =>
    (x - a.x) * normals[i]!.x + (z - a.z) * normals[i]!.z >= slopes[i]! * (height - y) - TOLERANCE);
  let reachesBelow = false;
  for (const edge of sourceEdges) {
    for (let i = 0; i + 2 < edge.length; i += 3) {
      const x = edge[i]!, y = edge[i + 1]!, z = edge[i + 2]!;
      if (y < bottom - TOLERANCE) reachesBelow = true;
      if (y >= bottom - TOLERANCE && !inEnvelope(x, y, z)) fits = false;
      if (i + 5 < edge.length) {
        const y2 = edge[i + 4]!;
        if ((y - bottom) * (y2 - bottom) < 0) {
          const t = (bottom - y) / (y2 - y);
          if (!inEnvelope(x + t * (edge[i + 3]! - x), bottom, z + t * (edge[i + 5]! - z))) fits = false;
        }
      }
    }
  }
  if (!reachesBelow) fits = false;
  const profiles: RimRoundProfile[] = loop.map((_, index) => {
    // Only this corner's two walls can change its profile. Using every rim
    // wall's tangent angle here creates hundreds of redundant spline spans and
    // makes downstream boolean intersections prohibitively expensive.
    const angles = [startAngle];
    for (const angle of [tangencies[(index + loop.length - 1) % loop.length]!, tangencies[index]!].sort((a, b) => a - b)) {
      if (angle - angles.at(-1)! > 1e-7) angles.push(angle);
    }
    angles.push(Math.PI / 2);
    // A shared rational-circle parameter t=tan(theta/2) keeps corresponding
    // heights aligned when OCCT lofts curves with different internal knots.
    const knots = angles.map((angle) => Math.tan(angle / 2));
    const start = pointAt(index, startAngle);
    const poles = [start.x, start.y, start.z];
    const weights = [1 + knots[0]! ** 2];
    for (let i = 1; i < angles.length; i++) {
      const a = pointAt(index, angles[i - 1]!), b = pointAt(index, angles[i]!);
      const t0 = knots[i - 1]!, t1 = knots[i]!, tm = (t0 + t1) / 2;
      const middle = pointAt(index, 2 * Math.atan(tm));
      const w0 = 1 + t0 * t0, w1 = 1 + t0 * t1, w2 = 1 + t1 * t1;
      for (const axis of ["x", "y", "z"] as const) poles.push((4 * (1 + tm * tm) * middle[axis] - w0 * a[axis] - w2 * b[axis]) / (2 * w1));
      poles.push(b.x, b.y, b.z);
      weights.push(w1, w2);
    }
    return { poles, weights, knots, multiplicities: angles.map((_, i) => i === 0 || i === angles.length - 1 ? 3 : 2) };
  });
  return { loop: bottomLoop, topLoop, bottom, height, top: height + Math.max(0.01, radius * 0.01), profiles, fits };
}
