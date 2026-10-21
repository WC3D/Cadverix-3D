import { immutableResourceFingerprint } from "@/lib/editorHistory";
// Bump when the geometry builder or bundled component models change.
export const PCB_GEOMETRY_REVISION = "bbbb552-1";
export function pcbGeometryRevision(scene: object) { return `${PCB_GEOMETRY_REVISION}:${immutableResourceFingerprint(scene)}`; }
