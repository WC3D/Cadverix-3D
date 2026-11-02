import { describe, expect, it } from "vitest";
import { MODIFIER_DEFAULTS, TEXTURE_PATTERNS, validateModifierJob, type ModifierJob } from "@/lib/layerlingModifierTypes";
import { flexiJointPositions, flexiKnuckleProfile, flexiNeck, flexiRingRadius } from "@/lib/flexiJoints";
import { textureImageValue, textureValue } from "@/lib/layerlingSolidTools";

describe("modifier input boundaries", () => {
  it.each(["flexi", "cookie", "lid", "offset", "simplify", "texture"] as const)("accepts %s defaults", (kind) => {
    expect(() => validateModifierJob({ kind, options: MODIFIER_DEFAULTS[kind] } as ModifierJob)).not.toThrow();
  });
  it("rejects invalid dimensions and selections", () => {
    expect(() => validateModifierJob({ kind: "offset", options: { amount: 0 } })).toThrow();
    expect(() => validateModifierJob({ kind: "simplify", options: { tolerance: NaN } })).toThrow();
    expect(() => validateModifierJob({ kind: "deleteFace", options: { faceIds: [] } })).toThrow();
    expect(() => validateModifierJob({ kind: "deleteFace", options: { faceIds: [-1] } })).toThrow();
    expect(() => validateModifierJob({ kind: "face", options: { ...MODIFIER_DEFAULTS.face, faceIds: [0, 1] } })).toThrow();
    expect(() => validateModifierJob({ kind: "texture", options: { ...MODIFIER_DEFAULTS.texture, depth: 2, spacing: 1 } })).toThrow();
    expect(() => validateModifierJob({ kind: "flexi", options: { ...MODIFIER_DEFAULTS.flexi, joints: 2.5 } })).toThrow();
    expect(() => validateModifierJob({ kind: "texture", options: { ...MODIFIER_DEFAULTS.texture, pattern: "image" } })).toThrow();
    expect(() => validateModifierJob({ kind: "texture", options: { ...MODIFIER_DEFAULTS.texture, pattern: "image", image: { width: 2, height: 2, values: [0, 1, 0] } } })).toThrow();
  });
});

describe("flexi calibration math", () => {
  it("spaces joints and honors first/last offsets", () => {
    expect(flexiJointPositions(0, 90, 2)).toEqual([30, 60]);
    expect(flexiJointPositions(0, 90, 2, 20, 10)).toEqual([20, 80]);
    expect(flexiJointPositions(0, 90, 1, 20)).toEqual([20]);
  });
  it("leaves a socket wall and caps swing to what the retained neck can clear", () => {
    const profile = flexiKnuckleProfile(6, 8);
    expect(profile.bulge).toBeGreaterThan(0.6);
    expect(flexiRingRadius(6, 0.4)).toBeGreaterThan(7.6);
    const neck = flexiNeck(6, profile.foot, 0.4, 60)!;
    expect(neck.neck).toBeGreaterThanOrEqual(0.6);
    expect(neck.swing).toBeLessThanOrEqual(Math.PI / 3);
  });
});

describe("procedural relief", () => {
  it("interpolates local height maps without exceeding their range", () => {
    const image = { width: 2, height: 2, values: [0, 1, 0, 1] };
    expect(textureImageValue(image, 0.5, 0.5)).toBeCloseTo(0.5);
    expect(textureImageValue(image, -0.25, 1.5)).toBeCloseTo(0.75);
    expect(() => validateModifierJob({ kind: "texture", options: { ...MODIFIER_DEFAULTS.texture, pattern: "image", image } })).not.toThrow();
  });
  it.each(TEXTURE_PATTERNS)("keeps %s values finite and normalized", (pattern) => {
    for (const x of [-2.3, 0, 0.1, 0.5, 1, 4.2]) for (const y of [-3, 0, 0.4, 2.1]) {
      const value = textureValue(pattern, x, y, 0.5);
      expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1);
    }
  });
});
