// Joint geometry adapted from henmedia/layerling flexiJoints.ts (AGPL-3.0).
import type { ManifoldToplevel, Mat4 } from "manifold-3d";
import type { ManifoldSolid } from "@/lib/manifoldSplit";
import type { FlexiOptions } from "@/lib/layerlingModifierTypes";

type Disposable = { delete(): void };
type Joint = { u: number; v: number; bottom: number; top: number; knuckle: number; foot: number; bulge: number; ring: number; neck: number; opening: number; swing: number };
const coneGap = (clearance: number) => clearance * Math.SQRT2;
export const flexiRingRadius = (knuckle: number, clearance: number) => knuckle * 1.1 + coneGap(clearance) + 1.2;
export const flexiKnuckleForHalfWidth = (width: number, clearance: number) => (width - 0.3 - coneGap(clearance) - 1.2) / 1.1;
export function flexiJointPositions(min: number, max: number, count: number, start = 0, end = 0) {
  if (count === 1) return [start ? min + start : end ? max - end : (min + max) / 2];
  const first = start ? min + start : min + (max - min) / (count + 1);
  const last = end ? max - end : max - (max - min) / (count + 1);
  return Array.from({ length: count }, (_, i) => first + (last - first) * i / (count - 1));
}
export function flexiKnuckleProfile(knuckle: number, height: number) {
  const bulge = Math.min(0.45 * knuckle, (height - 0.8) / 2);
  return { bulge, foot: knuckle - bulge };
}
export function flexiNeck(knuckle: number, foot: number, clearance: number, degrees: number) {
  const socket = knuckle + coneGap(clearance), narrowest = foot + coneGap(clearance);
  const opening = Math.asin(Math.min(0.95, (knuckle - Math.max(0.5, 0.15 * knuckle)) / socket));
  const swing = Math.min(degrees * Math.PI / 180, opening - Math.asin(Math.min(1, (0.6 + clearance) / narrowest)));
  if (swing < 5 * Math.PI / 180) return null;
  return { opening, swing, neck: Math.max(0.6, Math.min(narrowest * Math.sin(opening - swing) - clearance, 0.9 * foot)) };
}
export function flexiMinimumSpacing(a: Joint, b: Joint, gap: number) {
  const lean = Math.tan(Math.max(a.swing, b.swing) / 2), side = Math.abs(a.v - b.v);
  return Math.max(a.ring + b.ring + 2 * gap + 0.5, b.ring + 2 * gap + 0.5 + (side + b.ring) * lean, a.ring + 2 * gap + 0.5 + (side + a.ring) * lean);
}

export function articulateSolid(runtime: ManifoldToplevel, body: ManifoldSolid, options: FlexiOptions) {
  const made: Disposable[] = [];
  const results: ManifoldSolid[] = [];
  const keep = <T extends Disposable>(value: T): T => { made.push(value); return value; };
  try {
    const box = body.boundingBox();
    const axis = options.axis === "auto" ? box.max[0] - box.min[0] >= box.max[2] - box.min[2] ? "x" : "z" : options.axis;
    const along = axis === "x" ? [1, 0, 0] : [0, 0, 1];
    const side = axis === "x" ? [0, 0, -1] : [1, 0, 0];
    const toFrame: Mat4 = [along[0], side[0], 0, 0, along[1], side[1], 1, 0, along[2], side[2], 0, 0, 0, 0, 0, 1];
    const toWorld: Mat4 = [along[0], along[1], along[2], 0, side[0], side[1], side[2], 0, 0, 1, 0, 0, 0, 0, 0, 1];
    const local = keep(body.transform(toFrame));
    const alongUp = keep(local.transform([0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1]));
    const bounds = local.boundingBox(), length = bounds.max[0] - bounds.min[0], width = bounds.max[1] - bounds.min[1];
    const low = bounds.min[2] - 1, high = bounds.max[2] + 1, far = 4 * Math.hypot(length, width, high - low) + 20;
    const rect = (x0: number, y0: number, x1: number, y1: number) => keep(runtime.CrossSection.ofPolygons([[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]]));
    const siteAt = (u: number) => {
      const section = keep(alongUp.slice(u)), pieces = section.decompose(); made.push(...pieces);
      const piece = pieces.sort((a, b) => b.area() - a.area())[0];
      if (!piece || piece.area() <= 1e-6) return null;
      const b = piece.bounds(), middle = (b.min[1] + b.max[1]) / 2;
      const across = keep(piece.intersect(rect(b.min[0] - 1, middle - 0.05, b.max[0] + 1, middle + 0.05)));
      const spans = across.decompose(); made.push(...spans);
      const widest = spans.map((span) => span.bounds()).sort((a, b) => (b.max[0] - b.min[0]) - (a.max[0] - a.min[0]))[0];
      if (!widest) return null;
      const v = (widest.min[0] + widest.max[0]) / 2;
      const column = keep(piece.intersect(rect(v - 0.05, b.min[1] - 1, v + 0.05, b.max[1] + 1))).bounds();
      return column.max[1] > column.min[1] ? { v, halfWidth: (widest.max[0] - widest.min[0]) / 2, bottom: column.min[1], top: column.max[1] } : null;
    };
    const automaticKnuckle = Math.max(2, Math.min(6, flexiKnuckleForHalfWidth(width / 2, options.clearance)));
    const ring = flexiRingRadius(automaticKnuckle, options.clearance);
    let count = options.joints || Math.max(1, Math.min(15, Math.floor(length / (2 * ring + 2 * options.clearance + 0.5 + 2 * ring * Math.tan(options.swing * Math.PI / 360))) - 1));
    let plans: Joint[] = [];
    for (;;) {
      plans = [];
      let tooClose = false;
      for (const [index, u] of flexiJointPositions(bounds.min[0], bounds.max[0], count, options.start, options.end).entries()) {
        if (u <= bounds.min[0] + 1 || u >= bounds.max[0] - 1 || plans.length && u <= plans[plans.length - 1].u) throw new Error("Joint offsets do not fit the body's length");
        const site = siteAt(u);
        if (!site) throw new Error(`Joint ${index + 1} misses the body`);
        const height = site.top - site.bottom;
        let knuckle = Math.min(options.size ? options.size / 2 : 6, flexiKnuckleForHalfWidth(site.halfWidth, options.clearance));
        let plan: Joint | null = null;
        while (knuckle >= 2) {
          const profile = flexiKnuckleProfile(knuckle, height);
          if (profile.bulge < 0.6) throw new Error(`Body is too flat at joint ${index + 1}`);
          const radius = flexiRingRadius(knuckle, options.clearance);
          const disc = keep(runtime.CrossSection.circle(radius, 48));
          const probe = keep(keep(disc.extrude(height - 0.8)).translate([u, site.v, site.bottom + 0.4]));
          const inside = keep(local.intersect(probe)), neck = flexiNeck(knuckle, profile.foot, options.clearance, options.swing);
          if (inside.volume() >= 0.97 * probe.volume() && neck) {
            plan = { u, v: site.v, bottom: site.bottom, top: site.top, knuckle, ...profile, ring: radius, ...neck }; break;
          }
          knuckle *= 0.85;
        }
        if (!plan) throw new Error(`Body is too narrow for a retained socket at joint ${index + 1}`);
        const previous = plans[plans.length - 1];
        if (previous && plan.u - previous.u < flexiMinimumSpacing(previous, plan, options.clearance)) { tooClose = true; break; }
        plans.push(plan);
      }
      if (!tooClose) break;
      if (options.joints || count <= 1) throw new Error("Joints are too close; reduce the count or diameter");
      count--;
    }
    const prism = (polygon: [number, number][]) => keep(keep(keep(runtime.CrossSection.ofPolygons([polygon])).extrude(high - low)).translate([0, 0, low]));
    const column = (p: Joint, grow: number) => {
      const base = p.bottom + 0.4, crown = p.top - 0.4;
      const outline: [number, number][] = [[0, low], [p.foot + grow, low], [p.foot + grow, base], [p.knuckle + grow, base + p.bulge], [p.knuckle + grow, crown - p.bulge], [p.foot + grow, crown], [p.foot + grow, high], [0, high]];
      const points = outline.filter((point, i) => !i || Math.hypot(point[0] - outline[i - 1][0], point[1] - outline[i - 1][1]) > 1e-9);
      return keep(keep(keep(runtime.CrossSection.ofPolygons([points])).revolve(Math.max(32, Math.min(128, Math.ceil(2 * Math.PI * (p.knuckle + grow) / 0.5))))).translate([p.u, p.v, 0]));
    };
    const sides = plans.map((p) => {
      const sector = (u: number, v: number, middle: number, spread: number, reach: number) => {
        const ray = (angle: number): [number, number] => [u + reach * Math.cos(angle), v + reach * Math.sin(angle)];
        return prism([[u, v], ray(middle - spread), ray(middle), ray(middle + spread)]);
      };
      const half = Math.PI / 2 - p.swing / 2, shift = options.clearance / 2 / Math.sin(half);
      const aSide = sector(p.u - shift, p.v, Math.PI, half, far);
      const clear = keep(keep(keep(runtime.CrossSection.circle(p.ring + options.clearance, 96)).extrude(high - low)).translate([p.u, p.v, low]));
      const outerA = keep(aSide.subtract(clear)), knuckle = column(p, 0), reach = p.ring + options.clearance + 0.5;
      const neck = prism([[p.u - reach, p.v - p.neck], [p.u, p.v - p.neck], [p.u, p.v + p.neck], [p.u - reach, p.v + p.neck]]);
      const a = keep(runtime.Manifold.union([outerA, knuckle, neck]));
      const bSide = sector(p.u + shift, p.v, 0, half, far);
      const ringColumn = keep(keep(keep(runtime.CrossSection.circle(p.ring, 96)).extrude(high - low)).translate([p.u, p.v, low]));
      const opening = sector(p.u, p.v, Math.PI, p.opening, 2 * p.ring + 2);
      const ring = keep(ringColumn.subtract(opening)), socket = column(p, coneGap(options.clearance));
      const b = keep(keep(runtime.Manifold.union([bSide, ring])).subtract(socket));
      return { a, b };
    });
    for (let i = 0; i <= plans.length; i++) {
      const before = i ? sides[i - 1].b : null, after = i < plans.length ? sides[i].a : null;
      const region = before && after ? keep(before.intersect(after)) : (before ?? after)!;
      const link = keep(local.intersect(region));
      if (link.status() !== "NoError" || link.volume() <= 1e-3) throw new Error(`Joint ${i + 1} produced an empty link`);
      results.push(link.transform(toWorld));
    }
    return { links: results, swing: Math.min(...plans.map((p) => p.swing * 180 / Math.PI)) };
  } catch (error) {
    results.forEach((value) => value.delete());
    throw error;
  } finally { new Set(made).forEach((value) => value.delete()); }
}
