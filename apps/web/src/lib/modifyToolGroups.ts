export const MODIFY_TOOL_GROUPS = [
  { label: "Transform", tools: ["Align", "Mirror", "3D pattern / array", "Face tools / rotation pivot", "Snap to grid"] },
  { label: "Shape", tools: ["Chamfer", "Fillet", "Shell / hollow", "Face hole pattern", "Offset body", "Delete faces", "Push / pocket face", "Modeling tools"] },
  { label: "Print", tools: ["Flexi joints", "Cookie cutter", "Lid"] },
  { label: "Mesh", tools: ["Simplify mesh", "Surface texture"] },
] as const;
