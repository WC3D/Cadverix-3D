import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import fontJson from "three/examples/fonts/helvetiker_bold.typeface.json";
import { fitTextGeometry } from "@/lib/textGeometry";
import type { WorkplaneShape } from "@/types/sketchforge";

const font = new FontLoader().parse(fontJson);
const base: WorkplaneShape = {
  id: "text", name: "Text", kind: "text", color: "#ffffff",
  x: 0, z: 0, size: 114, width: 114, depth: 28, height: 2.28, rotation: 0,
};

describe("independent text dimensions", () => {
  it.each([0, 45, 90, 137])("keeps letter height and extrusion independent at %s degrees", (angle) => {
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(angle), 0.37, -0.21,
    ));
    for (const patch of [{}, { depth: 42 }, { height: 6 }, { width: 80 }]) {
      const shape = { ...base, ...patch };
      const geometry = fitTextGeometry(new TextGeometry("COINS", {
        font, size: 20, depth: shape.height,
        bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.4, bevelSegments: 2,
      }), shape);
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.min.y).toBeCloseTo(0, 5);
      geometry.applyQuaternion(rotation);
      // Measure in the text's own axes, not the world-aligned bounding box.
      geometry.applyQuaternion(rotation.clone().invert());
      geometry.computeBoundingBox();
      const size = geometry.boundingBox!.getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(shape.width!, 4);
      expect(size.y).toBeCloseTo(shape.height, 4);
      expect(size.z).toBeCloseTo(shape.depth!, 4);
      geometry.dispose();
    }
  });

  it("leaves blank text finite", () => {
    const geometry = fitTextGeometry(new TextGeometry(" ", { font, depth: 2 }), base);
    expect(Array.from(geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true);
    geometry.dispose();
  });
});
