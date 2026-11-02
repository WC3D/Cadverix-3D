import { describe, expect, it } from "vitest";
import { MODIFY_TOOL_GROUPS } from "@/lib/modifyToolGroups";
import { MODIFIER_LABELS, NEW_MODIFIERS } from "@/lib/layerlingModifierTypes";

describe("grouped Modify tools", () => {
  it("keeps every existing tool exactly once in four categories", () => {
    const tools = MODIFY_TOOL_GROUPS.flatMap((group) => [...group.tools]);
    expect(MODIFY_TOOL_GROUPS.map((group) => group.label)).toEqual(["Transform", "Shape", "Print", "Mesh"]);
    expect(new Set(tools).size).toBe(tools.length);
    expect([...tools].sort()).toEqual([
      "Align", "Mirror", "3D pattern / array", "Face tools / rotation pivot", "Face hole pattern", "Shell / hollow",
      "Modeling tools", "Snap to grid", "Chamfer", "Fillet", ...NEW_MODIFIERS.map((kind) => MODIFIER_LABELS[kind]),
    ].sort());
  });
});
