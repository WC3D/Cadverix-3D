import { describe, expect, it } from "vitest";
import type { BufferGeometry } from "three";
import {
  THREAD_PRESETS,
  createNutGeometry,
  createScrewGeometry,
  createThreadedCylinderGeometry,
  createWasherGeometry,
  normalizeBoreDiameter,
  normalizeThreadDepth,
  normalizeThreadHandedness,
  normalizeThreadMode,
  normalizeThreadPitch,
  normalizeThreadQuality,
} from "@/lib/fastenerGeometry";

function edgeUseCounts(geometry: BufferGeometry) {
  const index = geometry.getIndex();
  const position = geometry.getAttribute("position");
  const uses = new Map<string, number>();
  const vertex = (offset: number) => index ? index.getX(offset) : offset;
  for (let offset = 0; offset + 2 < (index?.count ?? position.count); offset += 3) {
    const triangle = [vertex(offset), vertex(offset + 1), vertex(offset + 2)];
    for (let edge = 0; edge < 3; edge += 1) {
      const a = triangle[edge];
      const b = triangle[(edge + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      uses.set(key, (uses.get(key) ?? 0) + 1);
    }
  }
  return uses;
}

function signedVolume(geometry: BufferGeometry) {
  const index = geometry.getIndex();
  const position = geometry.getAttribute("position");
  const vertex = (offset: number) => index ? index.getX(offset) : offset;
  let volume = 0;
  for (let offset = 0; offset + 2 < (index?.count ?? position.count); offset += 3) {
    const a = vertex(offset);
    const b = vertex(offset + 1);
    const c = vertex(offset + 2);
    volume += (
      position.getX(a) * (position.getY(b) * position.getZ(c) - position.getZ(b) * position.getY(c))
      + position.getY(a) * (position.getZ(b) * position.getX(c) - position.getX(b) * position.getZ(c))
      + position.getZ(a) * (position.getX(b) * position.getY(c) - position.getY(b) * position.getX(c))
    ) / 6;
  }
  return volume;
}

function expectClosedFiniteGeometry(geometry: BufferGeometry, width: number, depth: number, height: number) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  expect(geometry.getIndex()).not.toBeNull();
  expect(position.count).toBeGreaterThan(20);
  expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
  expect(Array.from(normal.array).every(Number.isFinite)).toBe(true);
  expect([...edgeUseCounts(geometry).values()].every((uses) => uses === 2)).toBe(true);
  expect(signedVolume(geometry)).toBeGreaterThan(0);
  expect(geometry.boundingBox?.min.y).toBeCloseTo(0, 5);
  expect(geometry.boundingBox?.max.y).toBeCloseTo(height, 5);
  expect((geometry.boundingBox?.max.x ?? 0) - (geometry.boundingBox?.min.x ?? 0)).toBeCloseTo(width, 4);
  expect((geometry.boundingBox?.max.z ?? 0) - (geometry.boundingBox?.min.z ?? 0)).toBeCloseTo(depth, 4);
}

describe("fastener geometry", () => {
  it("provides metric and imperial presets in millimeters", () => {
    expect(THREAD_PRESETS.map((preset) => preset.label)).toEqual([
      "M3", "M4", "M5", "M6", "M8", "M10", "M12",
      "#8-32", "#10-24", "#10-32", "1/4-20", "1/4-28",
      "5/16-18", "5/16-24", "3/8-16", "3/8-24",
    ]);
    expect(THREAD_PRESETS.find((preset) => preset.label === "1/4-20")?.diameter).toBe(6.35);
    expect(THREAD_PRESETS.find((preset) => preset.label === "1/4-20")?.pitch).toBeCloseTo(1.27, 8);
    expect(THREAD_PRESETS.find((preset) => preset.label === "M6")).toMatchObject({ headAcrossFlats: 10, headHeight: 4, nutAcrossFlats: 10, nutHeight: 5 });
    expect(THREAD_PRESETS.find((preset) => preset.label === "1/4-20")?.headAcrossFlats).toBeCloseTo(11.1125, 6);
  });

  it("normalizes thread controls to safe bounded values", () => {
    expect(normalizeThreadMode("internal")).toBe("internal");
    expect(normalizeThreadMode("invalid")).toBe("external");
    expect(normalizeThreadHandedness("invalid")).toBe("right");
    expect(normalizeThreadPitch(-1, 8)).toBe(0.1);
    expect(normalizeThreadDepth(100, 10, 1.5)).toBe(2.2);
    expect(normalizeBoreDiameter(20, 10)).toBe(9);
    expect(normalizeThreadQuality(1)).toBe(12);
    expect(normalizeThreadQuality(1000)).toBe(96);
  });

  it("creates a watertight external threaded cylinder", () => {
    expectClosedFiniteGeometry(createThreadedCylinderGeometry({
      width: 12, depth: 10, height: 15, threadMode: "external", threadPitch: 1.5, threadDepth: 0.7,
    }), 12, 10, 15);
  });

  it("creates a watertight internal threaded annular cylinder", () => {
    expectClosedFiniteGeometry(createThreadedCylinderGeometry({
      width: 18, depth: 14, height: 9, boreDiameter: 7, threadMode: "internal", threadPitch: 1.25,
    }), 18, 14, 9);
  });

  it("creates a watertight left-hand threaded cylinder", () => {
    expectClosedFiniteGeometry(createThreadedCylinderGeometry({
      width: 10, depth: 10, height: 12, threadMode: "external", threadHandedness: "left", threadPitch: 1,
    }), 10, 10, 12);
  });

  it("creates a screw as one watertight shaft and hex-head shell", () => {
    expectClosedFiniteGeometry(createScrewGeometry({
      width: 14, depth: 12, height: 24, shaftDiameter: 7, headHeight: 5, threadPitch: 1.25,
    }), 14, 12, 24);
  });

  it("creates a watertight hex nut with a threaded bore", () => {
    expectClosedFiniteGeometry(createNutGeometry({
      width: 16, depth: 14, height: 7, boreDiameter: 7, threadPitch: 1.25,
    }), 16, 14, 7);
  });

  it("creates a watertight washer", () => {
    expectClosedFiniteGeometry(createWasherGeometry({
      width: 18, depth: 14, height: 2, boreDiameter: 8,
    }), 18, 14, 2);
  });
});
