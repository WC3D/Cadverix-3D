import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ModelingTools, type ModelingToolSection } from "@/components/ModelingTools";
import { DEFAULT_HOLE_PATTERN } from "@/lib/holePattern";
import { DEFAULT_SECTION } from "@/lib/viewportInspection";

const noop = () => {};
const props: ComponentProps<typeof ModelingTools> = {
  onSelectSection: noop, onClose: noop, onPattern: noop, onFace: noop, onRotate: noop, onShell: noop,
  hasPivot: false, onClearPivot: noop, disabled: false, patternCenter: null, pickingCenter: false,
  onPickCenter: noop, onClearCenter: noop, onCancelCenter: noop, section: DEFAULT_SECTION,
  onSection: noop, overhangAngle: null, onOverhangAngle: noop, onSaveCustomShape: async () => new Uint8Array(),
  onInsertCustomShape: async () => {}, holeSettings: DEFAULT_HOLE_PATTERN, onHoleSettings: noop,
  holeCount: 0, holeBusy: false, onPickHoles: noop, onApplyHoles: noop, onClearHoles: noop,
};

describe("focused modeling panels", () => {
  it.each<[ModelingToolSection, string]>([
    ["shell", "Shell / hollow"], ["pattern", "3D pattern"], ["faces", "Face tools"],
    ["holes", "Face hole pattern"], ["inspect", "Inspect / print"], ["custom", "Reusable shapes"],
  ])("renders only the %s tool's controls", (activeSection, legend) => {
    const html = renderToStaticMarkup(createElement(ModelingTools, { ...props, activeSection }));
    expect(html.match(/<fieldset/g)).toHaveLength(1);
    expect(html).toContain(`<legend>${legend}</legend>`);
    expect(html).toContain("All modeling tools");
  });
  it("defaults to a compact chooser rather than mounting every tool", () => {
    const html = renderToStaticMarkup(createElement(ModelingTools, props));
    expect(html).toContain('aria-label="Choose modeling tool"');
    expect(html.match(/<button/g)).toHaveLength(7);
    expect(html).not.toContain("<fieldset");
    expect(html).not.toContain("<input");
  });
});
