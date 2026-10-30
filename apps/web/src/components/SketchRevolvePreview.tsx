"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type SketchPreviewBody = { positions: number[]; color: string };
const EMPTY_BODIES: SketchPreviewBody[] = [];

export function SketchRevolvePreview({ positions, bodies = EMPTY_BODIES, operation = "revolve", planeName = "Sketch plane" }: {
  positions: number[] | null;
  bodies?: SketchPreviewBody[];
  operation?: "extrude" | "revolve";
  planeName?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const [rendererUnavailable, setRendererUnavailable] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      const context = canvas.getContext("webgl2", { antialias: true, alpha: true });
      if (!context) throw new Error("WebGL2 is unavailable");
      renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: true });
      setRendererUnavailable(false);
    } catch {
      setRendererUnavailable(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 5000);
    const meshes = [...bodies, ...(positions?.length ? [{ positions, color: "#8ccf79" }] : [])].map((body) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(body.positions, 3));
      geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({ color: body.color, roughness: 0.68, metalness: 0.02, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      return mesh;
    });
    scene.add(new THREE.HemisphereLight("#ffffff", "#b7cadd", 2.2));
    const key = new THREE.DirectionalLight("#ffffff", 3.2);
    key.position.set(-3, 5, 4);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.DirectionalLight("#b9ddff", 1.2);
    fill.position.set(4, 2, -3);
    scene.add(fill);

    const bounds = new THREE.Box3();
    meshes.forEach((mesh) => bounds.expandByObject(mesh));
    if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-20, 0, -20), new THREE.Vector3(20, 10, 20));
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(1, bounds.getBoundingSphere(new THREE.Sphere()).radius);
    const grid = new THREE.GridHelper(radius * 2, 10, "#428bea", "#a3bfca");
    grid.position.set(center.x, 0, center.z);
    scene.add(grid);
    camera.position.set(center.x + radius * 1.8, center.y + radius * 1.2, center.z + radius * 2.1);
    camera.lookAt(center);
    camera.near = Math.max(0.01, radius / 100);
    camera.far = radius * 20;
    camera.updateProjectionMatrix();
    const controls = new OrbitControls(camera, canvas);
    controls.target.copy(center);
    if (viewRef.current) {
      camera.position.copy(viewRef.current.position);
      controls.target.copy(viewRef.current.target);
    }
    controls.update();

    const render = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    render();
    controls.addEventListener("change", render);
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => {
      viewRef.current = { position: camera.position.clone(), target: controls.target.clone() };
      observer.disconnect();
      controls.dispose();
      meshes.forEach((mesh) => { mesh.geometry.dispose(); mesh.material.dispose(); });
      grid.geometry.dispose();
      grid.material.dispose();
      renderer.dispose();
    };
  }, [positions, bodies]);

  return (
    <aside className="sketch-revolve-preview" aria-label={operation === "revolve" ? "Revolve 3D preview" : "Sketch 3D preview"} onPointerDown={(event) => event.stopPropagation()}>
      <div className="sketch-revolve-preview-title">3D preview · {planeName}</div>
      <canvas ref={canvasRef} aria-label="Orbitable 3D body preview" />
      {rendererUnavailable ? <div className="sketch-revolve-preview-empty">3D preview unavailable because WebGL is disabled</div> : null}
      <div className="sketch-preview-hint">{positions?.length ? "Drag to orbit · Scroll to zoom" : bodies.length ? "Existing bodies · Close a sketch profile to preview new geometry" : operation === "revolve" ? "Close a profile left of the axis to preview" : "Close a profile to preview the extrusion"}</div>
    </aside>
  );
}
