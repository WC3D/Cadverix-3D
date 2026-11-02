/// <reference lib="webworker" />
import type Module from "manifold-3d";
import type { ManifoldToplevel } from "manifold-3d";
import { articulateSolid } from "@/lib/flexiJoints";
import { cookieCutterForSolid, lidForSolid, textureSolid } from "@/lib/layerlingSolidTools";
import { validateModifierJob, type ModifierMesh, type SolidModifierRequest, type SolidModifierResponse } from "@/lib/layerlingModifierTypes";
import type { ManifoldSolid } from "@/lib/manifoldSplit";

self.onmessage = async (event: MessageEvent<SolidModifierRequest>) => {
  const created: ManifoldSolid[] = [];
  const keep = (solid: ManifoldSolid) => { created.push(solid); return solid; };
  try {
    const { job, parts, assetBase } = event.data;
    validateModifierJob(job);
    const url = new URL("manifold.js", assetBase).href;
    const module = await import(/* webpackIgnore: true */ url) as { default: typeof Module };
    const runtime: ManifoldToplevel = await module.default({ locateFile: ((file: string) => new URL(file, assetBase).href) as () => string });
    runtime.setup();
    if (!parts.length || parts.reduce((sum, part) => sum + (part.indices?.length ?? 0) / 3, 0) > 250_000) throw new Error("Select closed bodies totaling at most 250,000 triangles");
    const solids: ManifoldSolid[] = [], holes: ManifoldSolid[] = [];
    for (const part of parts) {
      if (!part.positions || !part.indices) throw new Error("Modifier requires mesh data");
      const mesh = new runtime.Mesh({ numProp: 3, vertProperties: part.positions, triVerts: part.indices, tolerance: 1e-5 });
      mesh.merge();
      const solid = keep(runtime.Manifold.ofMesh(mesh));
      if (solid.status() !== "NoError" || solid.isEmpty()) throw new Error("The selected mesh is not a closed solid. Repair it first.");
      (part.hole ? holes : solids).push(solid);
    }
    if (!solids.length) throw new Error("Select at least one solid body");
    let body = keep(runtime.Manifold.union(solids));
    if (holes.length) body = keep(body.subtract(keep(runtime.Manifold.union(holes))));
    let output: ManifoldSolid[], keepSource = false, warning: string | undefined;
    switch (job.kind) {
      case "flexi": {
        const result = articulateSolid(runtime, body, job.options); created.push(...result.links); output = result.links;
        warning = `Actual joint swing: ${result.swing.toFixed(1)}° per side. Calibrate clearance for your printer.`;
        break;
      }
      case "lid": output = [keep(lidForSolid(runtime, body, job.options))]; keepSource = true; break;
      case "cookie": output = [keep(cookieCutterForSolid(runtime, body, job.options))]; keepSource = true; break;
      case "simplify": output = [keep(body.simplify(job.options.tolerance))]; break;
      case "texture": output = [keep(textureSolid(runtime, body, job.options))]; break;
      default: throw new Error("This modifier requires the CAD worker");
    }
    const meshes: ModifierMesh[] = output.map((solid, index) => {
      if (solid.status() !== "NoError" || solid.isEmpty() || solid.volume() <= 0) throw new Error(`Modifier did not produce a valid closed body (${solid.status()}, volume ${solid.volume().toFixed(3)})`);
      const mesh = solid.getMesh(), positions = new Float32Array(mesh.numVert * 3);
      for (let i = 0; i < mesh.numVert; i++) positions.set(mesh.vertProperties.subarray(i * mesh.numProp, i * mesh.numProp + 3), i * 3);
      return { positions, indices: new Uint32Array(mesh.triVerts), suffix: job.kind === "flexi" ? `Link ${index + 1}` : job.kind === "lid" ? "Lid" : job.kind === "cookie" ? "Cookie cutter" : undefined };
    });
    self.postMessage({ meshes, keepSource, warning } satisfies SolidModifierResponse, { transfer: meshes.flatMap((mesh) => [mesh.positions.buffer, mesh.indices.buffer]) });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "Modifier failed; original retained" } satisfies SolidModifierResponse); }
  finally { new Set(created).forEach((solid) => solid.delete()); }
};
