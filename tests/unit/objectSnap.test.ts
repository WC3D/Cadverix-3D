import { expect, it } from "vitest";
import { objectSnapOffset } from "@/lib/objectSnap";
const target = { minX: 10, maxX: 20, minZ: 0, maxZ: 10 };
it("snaps edges and centers within reach and returns guide lines", () => {
  const result = objectSnapOffset({ minX: 0.2, maxX: 10.2, minZ: 0.3, maxZ: 10.3 }, [target], 0.5);
  expect(result.x).toBeCloseTo(-0.2);
  expect(result.z).toBeCloseTo(-0.3);
  expect(result.guides.length).toBeGreaterThan(0);
});
it("leaves the grid position unchanged when no object is close", () => {
  expect(objectSnapOffset({ minX: -100, maxX: -90, minZ: 0, maxZ: 10 }, [target], 0.5).x).toBeNull();
  expect(objectSnapOffset(target, [target], 0).guides).toEqual([]);
});
it("merges shared guide lines instead of drawing one per aligned target", () => {
  const result = objectSnapOffset(target, Array.from({ length: 1000 }, () => target), .5);
  expect(result.guides).toHaveLength(6);
});
