import { describe, expect, it } from "vitest";
import { visibleDimensionMarks, type DimensionMark } from "@/components/workplane/transformOverlayTypes";

const mark = (axis: DimensionMark["axis"], key: string = axis): DimensionMark => ({
  axis, key, handleKey: key, label: "20.00",
  x1: 0, y1: 0, x2: 20, y2: 0,
  e1x1: 0, e1y1: 0, e1x2: 0, e1y2: 10,
  e2x1: 20, e2y1: 0, e2x2: 20, e2y2: 10,
  labelX: 10, labelY: 10,
});

describe("selection dimension labels", () => {
  const width = mark("width");
  const depth = mark("depth");
  const height = mark("height");
  const elevation = mark("elevation");
  const alternate = mark("width", "far-width");
  const dimensions = { near: [width, depth], far: [alternate, depth], top: [height], lift: [elevation] };

  it("shows each size once without hovering and leaves elevation out", () => {
    expect(visibleDimensionMarks(dimensions, null)).toEqual([width, depth, height]);
  });
  it("uses the hovered handle's side without hiding other axes", () => {
    expect(visibleDimensionMarks(dimensions, "far")).toEqual([alternate, depth, height]);
  });
  it("adds elevation while lifting", () => {
    expect(visibleDimensionMarks(dimensions, "lift")).toEqual([width, depth, height, elevation]);
  });
  it("does not invent resize controls for parametric extrusions", () => {
    expect(visibleDimensionMarks({ top: [height], lift: [elevation] }, "missing")).toEqual([height]);
    expect(visibleDimensionMarks({}, null)).toEqual([]);
  });
});
