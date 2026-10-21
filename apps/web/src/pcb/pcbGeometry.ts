import * as THREE from "three";
import { VRMLLoader } from "three/examples/jsm/loaders/VRMLLoader.js";
import { createBoard, createCopperTraces, createProceduralModel, createResistorBands, disposeObject, modelUrl, normalizeKiCadModel } from "./vendor/components/Board3DPreview";
import { getPartFootprint, PART_PIXELS_PER_MM } from "./vendor/lib/circuitPartsExact";
import type { PcbDesign } from "./pcbDocument";
import type { WorkplaneShape } from "@/types/sketchforge";

const modelTextCache = new Map<string, Promise<string>>();
async function modelText(url: string) {
  let pending = modelTextCache.get(url);
  if (!pending) {
    pending = fetch(url, { signal: AbortSignal.timeout(30000) }).then((response) => { if (!response.ok) throw new Error(`Could not load PCB model ${url}`); return response.text(); }).catch((error) => { modelTextCache.delete(url); throw error; });
    modelTextCache.set(url, pending);
  }
  return pending;
}

export async function buildPcbGeometry(board: PcbDesign): Promise<{ shape: WorkplaneShape; warnings: string[] }> {
  const scene = board.scene;
  if (!scene.board?.shapes.some((shape) => shape.closed !== false && shape.points.length >= 3)) throw new Error("Draw a closed PCB outline before generating its assembly");
  const assembly = new THREE.Group(); assembly.scale.z = -1;
  const { group, bounds } = createBoard(scene.board, scene.parts);
  // The upstream preview recenters the board. Restore the PCB document origin
  // here so assembly placement survives footprint/outline dimension changes.
  assembly.position.set(bounds.centerX, 0, bounds.centerY);
  assembly.add(group, createCopperTraces(scene.board, bounds, scene.parts, scene.wires, scene.traceWidthMm ?? 0.25));
  const warnings: string[] = [];
  try {
    // Limit model parsing concurrency and reuse downloaded model text across revisions.
    let index = 0;
    const parts = scene.parts.filter((part) => !part.hidden);
    const tasks = await Promise.allSettled(Array.from({ length: Math.min(4, parts.length) }, async () => {
      while (index < parts.length) {
        const part = parts[index++], footprint = getPartFootprint(part.kind, part.footprint);
        const url = modelUrl(footprint.libraryId), procedural = createProceduralModel(footprint);
        if (!url && !procedural) { warnings.push(`${part.reference}: no 3D model for ${footprint.libraryId}`); continue; }
        const holes = footprint.pads.filter((pad) => pad.padType === "through-hole");
        const anchor = ["capacitor", "led", "rgb-led", "potentiometer"].includes(part.kind) && holes.length >= 2
          ? { xMm: holes.reduce((n, p) => n + p.xMm, 0) / holes.length, yMm: holes.reduce((n, p) => n + p.yMm, 0) / holes.length }
          : { xMm: footprint.widthMm / 2, yMm: footprint.heightMm / 2 };
        const wrapper = new THREE.Group(); wrapper.name = part.reference; wrapper.userData.partId = part.id;
        wrapper.position.set(part.x / PART_PIXELS_PER_MM - bounds.centerX, scene.board!.thicknessMm, -(part.y / PART_PIXELS_PER_MM - bounds.centerY));
        wrapper.rotation.y = (part.rotation ?? 0) * Math.PI / 180; if (part.mirrored) wrapper.scale.x = -1;
        const holder = new THREE.Group(); holder.position.set(anchor.xMm - footprint.widthMm / 2, 0, -(anchor.yMm - footprint.heightMm / 2)); wrapper.add(holder);
        assembly.add(wrapper);
        if (procedural) holder.add(procedural);
        else {
          const model = new VRMLLoader().parse(await modelText(url!), new URL(".", new URL(url!, window.location.href)).href);
          holder.add(normalizeKiCadModel(model, footprint, part.value));
          if (footprint.libraryId === "Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P10.16mm_Horizontal") holder.add(createResistorBands(part.value));
        }
      }
    }));
    const failed = tasks.find((task) => task.status === "rejected"); if (failed?.status === "rejected") throw failed.reason;
    assembly.updateMatrixWorld(true);
    const children: WorkplaneShape[] = []; let triangles = 0;
    const ownerIndices = new Map<string, number>();
    assembly.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const position = object.geometry.getAttribute("position"), indices = object.geometry.index;
      if (!position) return;
      const count = indices?.count ?? position.count; triangles += count / 3;
      if (triangles > 1000000) throw new Error("PCB reference exceeds one million triangles; use fewer components");
      const points: number[] = [], box = new THREE.Box3(), point = new THREE.Vector3();
      const mirrored = object.matrixWorld.determinant() < 0;
      for (let i = 0; i + 2 < count; i += 3) for (const offset of mirrored ? [0, 2, 1] : [0, 1, 2]) {
        point.fromBufferAttribute(position, indices?.getX(i + offset) ?? i + offset).applyMatrix4(object.matrixWorld);
        box.expandByPoint(point); points.push(point.x, point.y, point.z);
      }
      if (box.isEmpty()) return;
      const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
      for (let i = 0; i < points.length; i += 3) { points[i] -= center.x; points[i + 1] -= box.min.y; points[i + 2] -= center.z; }
      const material = (Array.isArray(object.material) ? object.material[0] : object.material) as THREE.MeshStandardMaterial;
      let owner: THREE.Object3D | null = object;
      while (owner && !owner.userData.partId) owner = owner.parent;
      const component = owner?.name ?? (object.name || "Board / copper");
      const ownerKey = String(owner?.userData.partId ?? "board"); const ownerIndex = ownerIndices.get(ownerKey) ?? 0; ownerIndices.set(ownerKey, ownerIndex + 1);
      children.push({ id: `${ownerKey}-${ownerIndex}`, name: component, kind: "mesh", color: material.color ? `#${material.color.getHexString()}` : "#237847", x: center.x, z: center.z, elevation: box.min.y, width: Math.max(size.x, 0.01), depth: Math.max(size.z, 0.01), height: Math.max(size.y, 0.01), size: Math.max(size.x, size.z, 0.01), rotation: 0, locked: false, hidden: false, hole: false,
        importedMesh: { positions: points, baseWidth: Math.max(size.x, 0.01), baseDepth: Math.max(size.z, 0.01), baseHeight: Math.max(size.y, 0.01), triangleCount: points.length / 9, sourceFormat: "json" } });
    });
    if (!children.length) throw new Error("PCB outline produced no geometry");
    const box = new THREE.Box3().setFromObject(assembly), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const shape: WorkplaneShape = { id: "pcb-template", name: board.name, kind: "mesh", x: center.x, z: center.z, elevation: box.min.y, width: Math.max(size.x, 0.01), depth: Math.max(size.z, 0.01), height: Math.max(size.y, 0.01), size: Math.max(size.x, size.z, 0.01), color: "#237847", rotation: 0, hidden: false, locked: false, hole: false,
      groupedBaseWidth: Math.max(size.x, 0.01), groupedBaseDepth: Math.max(size.z, 0.01), groupedBaseHeight: Math.max(size.y, 0.01), groupedShapes: children.map((child) => ({ ...child, x: child.x - center.x, z: child.z - center.z, elevation: (child.elevation ?? 0) - box.min.y })) };
    return { shape, warnings };
  } finally { disposeObject(assembly); }
}

export function refreshPcbInstance(previous: WorkplaneShape, template: WorkplaneShape, revision: string, unmodeledComponents = 0): WorkplaneShape {
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler((previous.rotationX ?? 0) * Math.PI / 180, previous.rotation * Math.PI / 180, (previous.rotationZ ?? 0) * Math.PI / 180, "XYZ"));
  const previousCenter = new THREE.Vector3(previous.x, (previous.elevation ?? 0) + previous.height / 2, previous.z);
  const worldOrigin = previousCenter.add(new THREE.Vector3(...previous.pcbInstance!.originOffset).applyQuaternion(quaternion));
  const originOffset: [number, number, number] = [-template.x, -(template.elevation ?? 0) - template.height / 2, -template.z];
  const center = worldOrigin.sub(new THREE.Vector3(...originOffset).applyQuaternion(quaternion));
  return { ...template, id: previous.id, name: previous.name, x: center.x, z: center.z, elevation: center.y - template.height / 2, rotation: previous.rotation, rotationX: previous.rotationX, rotationZ: previous.rotationZ, hidden: previous.hidden, locked: previous.locked,
    pcbInstance: { boardId: previous.pcbInstance!.boardId, revision, originOffset, ...(unmodeledComponents ? { unmodeledComponents } : {}) }, groupedShapes: template.groupedShapes?.map((child) => ({ ...child, id: `${previous.id}-${child.id}` })) };
}
