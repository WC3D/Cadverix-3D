import * as THREE from "three";
import { principalPlanePose, type PrincipalPlane } from "@/lib/constructionPlanes";

export const SKETCH_PLANES = [
  { id: "xz", label: "XZ · Top", color: "#32a879" },
  { id: "xy", label: "XY · Front", color: "#428bea" },
  { id: "yz", label: "YZ · Side", color: "#eb8053" },
] as const;

export function createSketchPlanePicker(size: number) {
  const group = new THREE.Group();
  for (const plane of SKETCH_PLANES) {
    const geometry = new THREE.PlaneGeometry(size, size);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: plane.color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, depthTest: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.quaternion.fromArray(principalPlanePose(plane.id).quaternion);
    mesh.userData.sketchPlane = plane.id;
    mesh.renderOrder = 20;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: plane.color, depthTest: false }));
    edges.renderOrder = 21;
    mesh.add(edges);
    group.add(mesh);
  }
  return group;
}

export function highlightSketchPlane(group: THREE.Group, plane: PrincipalPlane | null) {
  for (const child of group.children) {
    if (child instanceof THREE.Mesh) child.material.opacity = child.userData.sketchPlane === plane ? 0.55 : 0.22;
  }
}
