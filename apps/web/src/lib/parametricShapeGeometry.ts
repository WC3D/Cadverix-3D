import type { WorkplaneShape } from "@/types/sketchforge";

/** Shape-specific inputs that must invalidate viewport geometry caches. */
export function parametricShapeGeometryFields(shape: WorkplaneShape) {
  return {
    cornerFillet: shape.cornerFillet,
    topBottomFillet: shape.topBottomFillet,
    roundedBoxQuality: shape.roundedBoxQuality,
    starPoints: shape.starPoints,
    starInnerSize: shape.starInnerSize,
    starOuterFillet: shape.starOuterFillet,
    starInnerFillet: shape.starInnerFillet,
    starQuality: shape.starQuality,
    heartTipFillet: shape.heartTipFillet,
    heartQuality: shape.heartQuality,
    crescentThickness: shape.crescentThickness,
    crescentTipFillet: shape.crescentTipFillet,
    crescentQuality: shape.crescentQuality,
    screwHoleShaft: shape.screwHoleShaft,
    screwHoleHeadDepth: shape.screwHoleHeadDepth,
    screwHoleAngle: shape.screwHoleAngle,
    dovetailNeckWidth: shape.dovetailNeckWidth,
    dovetailClearance: shape.dovetailClearance,
    springTurns: shape.springTurns,
    springWire: shape.springWire,
    springQuality: shape.springQuality,
    honeycombCellSize: shape.honeycombCellSize,
    honeycombWallThickness: shape.honeycombWallThickness,
    honeycombFrameWidth: shape.honeycombFrameWidth,
    bentTubeSize: shape.bentTubeSize,
    bentTubeWall: shape.bentTubeWall,
    bentTubeQuality: shape.bentTubeQuality,
    bentTubeSegments: shape.bentTubeSegments,
  };
}
