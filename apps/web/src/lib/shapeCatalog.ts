import { canonicalizeShape } from "@/lib/workplaneShapes";
import { createLocalId } from "@/lib/localIds";
import {
  DEFAULT_GEAR_CENTER_HOLE_SIZE,
  DEFAULT_GEAR_HELIX_ANGLE,
  DEFAULT_GEAR_HELIX_QUALITY,
  DEFAULT_GEAR_TEETH,
  DEFAULT_GEAR_TOOTH_SIZE,
  DEFAULT_GEAR_TYPE,
  normalizeGearCenterHoleSize,
  normalizeGearHelixAngle,
  normalizeGearHelixQuality,
  normalizeGearTeeth,
  normalizeGearToothSize,
  normalizeGearToothWidth,
  normalizeGearType,
} from "@/lib/gearGeometry";
import { DEFAULT_THREAD_HANDEDNESS, DEFAULT_THREAD_QUALITY, METRIC_THREAD_PRESETS, normalizeThreadDepth } from "@/lib/fastenerGeometry";
import { DEFAULT_ROUNDED_BOX_CORNER_FILLET, DEFAULT_ROUNDED_BOX_QUALITY, DEFAULT_ROUNDED_BOX_TOP_BOTTOM_FILLET } from "@/lib/roundedBoxGeometry";
import { DEFAULT_STAR_INNER_SIZE, DEFAULT_STAR_POINTS, DEFAULT_STAR_QUALITY } from "@/lib/starGeometry";
import { DEFAULT_HEART_QUALITY, DEFAULT_HEART_TIP_FILLET } from "@/lib/heartGeometry";
import { DEFAULT_CRESCENT_QUALITY, DEFAULT_CRESCENT_TIP_FILLET } from "@/lib/crescentGeometry";
import { DEFAULT_SCREW_HOLE_ANGLE, DEFAULT_SCREW_HOLE_HEAD_DEPTH, DEFAULT_SCREW_HOLE_SHAFT } from "@/lib/screwHoleGeometry";
import { DEFAULT_DOVETAIL_CLEARANCE, DEFAULT_DOVETAIL_NECK_RATIO } from "@/lib/dovetailGeometry";
import { DEFAULT_SPRING_QUALITY, DEFAULT_SPRING_TURNS, DEFAULT_SPRING_WIRE } from "@/lib/springGeometry";
import { DEFAULT_HONEYCOMB_CELL_SIZE, DEFAULT_HONEYCOMB_FRAME_WIDTH, DEFAULT_HONEYCOMB_WALL_THICKNESS } from "@/lib/honeycombGeometry";
import { teardropHeightForTipAngle } from "@/lib/teardropGeometry";
import { DEFAULT_BENT_TUBE_SEGMENTS } from "@/lib/bentTubeGeometry";
import type { ShapeAsset, ShapeCustomization, ShapeKind, WorkplaneShape } from "@/types/sketchforge";

export type ToolbarShapeAsset = ShapeAsset & { menuIcon: string };

export const toolbarShapeAssets: ToolbarShapeAsset[] = [
  { id: "box", name: "Box", src: "assets/sketchforge/shape-icons-gray/box.png", menuIcon: "assets/sketchforge/shape-icons-gray/box.png", kind: "box", color: "#d41721" },
  { id: "rounded-box", name: "Rounded Box", src: "assets/sketchforge/shape-icons-gray/box.png", menuIcon: "assets/sketchforge/shape-icons-gray/box.png", kind: "roundedBox", color: "#d94a32" },
  { id: "cylinder", name: "Cylinder", src: "assets/sketchforge/shape-icons-gray/cylinder.png", menuIcon: "assets/sketchforge/shape-icons-gray/cylinder.png", kind: "cylinder", color: "#d97813" },
  { id: "ellipse", name: "Ellipse", src: "assets/sketchforge/shape-icons-gray/cylinder.png", menuIcon: "assets/sketchforge/shape-icons-gray/cylinder.png", kind: "ellipse", color: "#e08a25" },
  { id: "slot", name: "Capsule", src: "assets/sketchforge/shape-icons-gray/round-roof.png", menuIcon: "assets/sketchforge/shape-icons-gray/round-roof.png", kind: "slot", color: "#26a69a" },
  { id: "sphere", name: "Sphere", src: "assets/sketchforge/shape-icons-gray/sphere.png", menuIcon: "assets/sketchforge/shape-icons-gray/sphere.png", kind: "sphere", color: "#0098c7" },
  { id: "cone", name: "Cone", src: "assets/sketchforge/shape-icons-gray/cone.png", menuIcon: "assets/sketchforge/shape-icons-gray/cone.png", kind: "cone", color: "#6e2786" },
  { id: "pyramid", name: "Pyramid", src: "assets/sketchforge/shape-icons-gray/pyramid.png", menuIcon: "assets/sketchforge/shape-icons-gray/pyramid.png", kind: "pyramid", color: "#f2cf10" },
  { id: "wedge", name: "Wedge", src: "assets/sketchforge/shape-icons-gray/wedge.png", menuIcon: "assets/sketchforge/shape-icons-gray/wedge.png", kind: "wedge", color: "#33983d" },
  { id: "star", name: "Star", src: "assets/sketchforge/shape-icons-gray/gear.svg", menuIcon: "assets/sketchforge/shape-icons-gray/gear.svg", kind: "star", color: "#f2cf10" },
  { id: "heart", name: "Heart", src: "assets/sketchforge/shape-icons-gray/half-sphere.png", menuIcon: "assets/sketchforge/shape-icons-gray/half-sphere.png", kind: "heart", color: "#e83e6f" },
  { id: "crescent", name: "Crescent", src: "assets/sketchforge/shape-icons-gray/half-sphere.png", menuIcon: "assets/sketchforge/shape-icons-gray/half-sphere.png", kind: "crescent", color: "#7c6bd0" },
  { id: "teardrop", name: "Teardrop", src: "assets/sketchforge/shape-icons-gray/cone.png", menuIcon: "assets/sketchforge/shape-icons-gray/cone.png", kind: "teardrop", color: "#4aa6c7", hole: true },
  { id: "counterbore", name: "Counterbore", src: "assets/sketchforge/shape-icons-gray/tube.png", menuIcon: "assets/sketchforge/shape-icons-gray/tube.png", kind: "counterbore", color: "#8a98a6", hole: true },
  { id: "countersink", name: "Countersink", src: "assets/sketchforge/shape-icons-gray/cone.png", menuIcon: "assets/sketchforge/shape-icons-gray/cone.png", kind: "countersink", color: "#8a98a6", hole: true },
  { id: "dovetail", name: "Dovetail", src: "assets/sketchforge/shape-icons-gray/wedge.png", menuIcon: "assets/sketchforge/shape-icons-gray/wedge.png", kind: "dovetail", color: "#7f8c4f" },
  { id: "text", name: "Text", src: "assets/sketchforge/shape-icons-gray/text.png", menuIcon: "assets/sketchforge/shape-icons-gray/text.png", kind: "text", color: "#cf101b" },
  { id: "round-roof", name: "Round Roof", src: "assets/sketchforge/shape-icons-gray/round-roof.png", menuIcon: "assets/sketchforge/shape-icons-gray/round-roof.png", kind: "roundRoof", color: "#67c4ce" },
  { id: "half-sphere", name: "Half Sphere", src: "assets/sketchforge/shape-icons-gray/half-sphere.png", menuIcon: "assets/sketchforge/shape-icons-gray/half-sphere.png", kind: "halfSphere", color: "#c9009a" },
  { id: "torus", name: "Torus", src: "assets/sketchforge/shape-icons-gray/torus.png", menuIcon: "assets/sketchforge/shape-icons-gray/torus.png", kind: "torus", color: "#0098c7" },
  { id: "tube", name: "Tube", src: "assets/sketchforge/shape-icons-gray/tube.png", menuIcon: "assets/sketchforge/shape-icons-gray/tube.png", kind: "tube", color: "#ce7013" },
  { id: "gear", name: "Gear", src: "assets/sketchforge/gear-types/spur.png", menuIcon: "assets/sketchforge/gear-types/spur.png", kind: "gear", color: "#6f7f8d" },
  { id: "screw", name: "Screw", src: "assets/sketchforge/shape-icons-gray/screw.svg", menuIcon: "assets/sketchforge/shape-icons-gray/screw.svg", kind: "screw", color: "#677786" },
  { id: "washer", name: "Washer", src: "assets/sketchforge/shape-icons-gray/washer.svg", menuIcon: "assets/sketchforge/shape-icons-gray/washer.svg", kind: "washer", color: "#81909d" },
  { id: "nut", name: "Nut", src: "assets/sketchforge/shape-icons-gray/nut.svg", menuIcon: "assets/sketchforge/shape-icons-gray/nut.svg", kind: "nut", color: "#596976" },
  { id: "spring", name: "Spring", src: "assets/sketchforge/shape-icons-gray/torus.png", menuIcon: "assets/sketchforge/shape-icons-gray/torus.png", kind: "spring", color: "#667784" },
  { id: "honeycomb", name: "Honeycomb", src: "assets/sketchforge/shape-icons-gray/gear.svg", menuIcon: "assets/sketchforge/shape-icons-gray/gear.svg", kind: "honeycomb", color: "#d4a017" },
  { id: "bent-tube", name: "Bent Tube", src: "assets/sketchforge/shape-icons-gray/tube.png", menuIcon: "assets/sketchforge/shape-icons-gray/tube.png", kind: "bentTube", color: "#3d91a8" },
];

const GENERATOR_KINDS: ReadonlySet<ShapeKind> = new Set(["gear", "screw", "washer", "nut", "spring", "honeycomb", "bentTube"]);
export const toolbarBasicShapeAssets = toolbarShapeAssets.filter((asset) => !GENERATOR_KINDS.has(asset.kind));
export const toolbarGeneratorAssets = toolbarShapeAssets.filter((asset) => GENERATOR_KINDS.has(asset.kind));

export function shapeAssetDefaultDimensions(kind: ShapeKind) {
  const m6 = METRIC_THREAD_PRESETS.find((preset) => preset.id === "m6")!;
  if (kind === "screw") return { width: m6.headAcrossFlats * 2 / Math.sqrt(3), depth: m6.headAcrossFlats, height: 24 };
  if (kind === "nut") return { width: m6.nutAcrossFlats * 2 / Math.sqrt(3), depth: m6.nutAcrossFlats, height: m6.nutHeight };
  if (kind === "washer") return { width: 12, depth: 12, height: 1.6 };
  if (kind === "roundedBox") return { width: 40, depth: 30, height: 20 };
  if (kind === "ellipse") return { width: 26, depth: 16, height: 20 };
  if (kind === "slot") return { width: 40, depth: 20, height: 20 };
  if (kind === "star" || kind === "heart" || kind === "crescent") return { width: 40, depth: 40, height: 10 };
  if (kind === "teardrop") return { width: 6, depth: 20, height: teardropHeightForTipAngle(6, 90) };
  if (kind === "counterbore") return { width: 6.4, depth: 6.4, height: 12 };
  if (kind === "countersink") return { width: 6.6, depth: 6.6, height: 8 };
  if (kind === "dovetail") return { width: 30, depth: 20, height: 10 };
  if (kind === "spring") return { width: 20, depth: 20, height: 30 };
  if (kind === "honeycomb") return { width: 60, depth: 60, height: 3 };
  if (kind === "bentTube") return { width: 55, depth: 30, height: 10 };
  const roundProfile = kind === "sphere" || kind === "torus" || kind === "ring" || kind === "halfSphere";
  const flatProfile = kind === "torus" || kind === "ring" || kind === "text" || kind === "gear";
  const size = kind === "gear" ? 30 : roundProfile ? 22 : 20;
  return {
    width: kind === "text" ? 86 : size,
    depth: kind === "text" ? 28 : size,
    height: kind === "gear" ? 6 : kind === "text" ? 10 : kind === "roundRoof" ? 10 : kind === "halfSphere" ? 11 : flatProfile ? 5 : 20,
  };
}

export function shapeAssetSpecialDefaults(kind: ShapeKind, dimensions = shapeAssetDefaultDimensions(kind)): ShapeCustomization {
  if (kind === "cylinder") return { sides: 96 };
  if (kind === "sphere") return { steps: 24 };
  if (kind === "halfSphere") return { steps: 32 };
  if (kind === "cone") return { topRadius: 0, baseRadius: dimensions.width / 2, sides: 96 };
  if (kind === "pyramid") return { sides: 4 };
  if (kind === "roundRoof") return { sides: 64 };
  if (kind === "ellipse" || kind === "slot" || kind === "teardrop") return { sides: 96 };
  if (kind === "roundedBox") return { cornerFillet: DEFAULT_ROUNDED_BOX_CORNER_FILLET, topBottomFillet: DEFAULT_ROUNDED_BOX_TOP_BOTTOM_FILLET, roundedBoxQuality: DEFAULT_ROUNDED_BOX_QUALITY };
  if (kind === "star") return { starPoints: DEFAULT_STAR_POINTS, starInnerSize: DEFAULT_STAR_INNER_SIZE, starOuterFillet: 0, starInnerFillet: 0, starQuality: DEFAULT_STAR_QUALITY };
  if (kind === "heart") return { heartTipFillet: DEFAULT_HEART_TIP_FILLET, heartQuality: DEFAULT_HEART_QUALITY };
  if (kind === "crescent") return { crescentThickness: dimensions.width * 0.35, crescentTipFillet: DEFAULT_CRESCENT_TIP_FILLET, crescentQuality: DEFAULT_CRESCENT_QUALITY };
  if (kind === "counterbore") return { sides: 96, screwHoleShaft: DEFAULT_SCREW_HOLE_SHAFT, screwHoleHeadDepth: DEFAULT_SCREW_HOLE_HEAD_DEPTH };
  if (kind === "countersink") return { sides: 96, screwHoleShaft: DEFAULT_SCREW_HOLE_SHAFT, screwHoleAngle: DEFAULT_SCREW_HOLE_ANGLE };
  if (kind === "dovetail") return { dovetailNeckWidth: dimensions.width * DEFAULT_DOVETAIL_NECK_RATIO, dovetailClearance: DEFAULT_DOVETAIL_CLEARANCE };
  if (kind === "spring") return { springTurns: DEFAULT_SPRING_TURNS, springWire: DEFAULT_SPRING_WIRE, springQuality: DEFAULT_SPRING_QUALITY };
  if (kind === "honeycomb") return { honeycombCellSize: DEFAULT_HONEYCOMB_CELL_SIZE, honeycombWallThickness: DEFAULT_HONEYCOMB_WALL_THICKNESS, honeycombFrameWidth: DEFAULT_HONEYCOMB_FRAME_WIDTH };
  if (kind === "bentTube") return { bentTubeSize: 10, bentTubeWall: 1.5, bentTubeQuality: 32, bentTubeSegments: DEFAULT_BENT_TUBE_SEGMENTS.map((segment) => ({ ...segment })) };
  if (kind === "tube" || kind === "ring") return { bevel: 4 };
  if (kind === "text") return { text: "TEXT", font: "Multilanguage", bevel: 0, segments: 0 };
  if (kind === "gear") {
    const teeth = DEFAULT_GEAR_TEETH;
    const toothSize = normalizeGearToothSize(DEFAULT_GEAR_TOOTH_SIZE, dimensions.width, dimensions.depth);
    return {
      teeth,
      toothSize,
      toothWidth: normalizeGearToothWidth(undefined, dimensions.width, dimensions.depth, teeth),
      centerHoleSize: normalizeGearCenterHoleSize(DEFAULT_GEAR_CENTER_HOLE_SIZE, dimensions.width, dimensions.depth, toothSize),
      gearType: DEFAULT_GEAR_TYPE,
      helixAngle: DEFAULT_GEAR_HELIX_ANGLE,
      helixQuality: DEFAULT_GEAR_HELIX_QUALITY,
    };
  }
  const m6 = METRIC_THREAD_PRESETS.find((preset) => preset.id === "m6")!;
  if (kind === "screw") return {
    threadMode: "external", threadFamily: "metric", threadPreset: m6.id, threadPitch: m6.pitch,
    threadDepth: normalizeThreadDepth(undefined, m6.diameter, m6.pitch), threadHandedness: DEFAULT_THREAD_HANDEDNESS,
    threadQuality: DEFAULT_THREAD_QUALITY, shaftDiameter: m6.diameter, headHeight: m6.headHeight,
  };
  if (kind === "nut") return {
    threadMode: "internal", threadFamily: "metric", threadPreset: m6.id, threadPitch: m6.pitch,
    threadDepth: normalizeThreadDepth(undefined, m6.diameter, m6.pitch), threadHandedness: DEFAULT_THREAD_HANDEDNESS,
    threadQuality: DEFAULT_THREAD_QUALITY, boreDiameter: m6.diameter,
  };
  if (kind === "washer") return { boreDiameter: 6.6, threadQuality: DEFAULT_THREAD_QUALITY };
  return {};
}

export function sceneShape(shape: Partial<WorkplaneShape> & Pick<WorkplaneShape, "name" | "kind" | "color">): WorkplaneShape {
  const width = shape.width ?? shape.size ?? 20;
  const depth = shape.depth ?? shape.size ?? 20;
  const height = shape.height ?? 20;
  return canonicalizeShape({
    id: shape.id ?? createLocalId("shape"),
    name: shape.name,
    kind: shape.kind,
    color: shape.color,
    hole: shape.hole,
    x: shape.x ?? 0,
    z: shape.z ?? 0,
    elevation: shape.elevation ?? 0,
    size: shape.size ?? Math.max(width, depth),
    width,
    depth,
    height,
    rotation: shape.rotation ?? 0,
    rotationX: shape.rotationX ?? 0,
    rotationZ: shape.rotationZ ?? 0,
    radius: shape.radius,
    steps: shape.steps,
    sides: shape.sides,
    bevel: shape.bevel,
    segments: shape.segments,
    topRadius: shape.topRadius,
    baseRadius: shape.baseRadius,
    taperTopWidth: shape.taperTopWidth,
    taperTopDepth: shape.taperTopDepth,
    taperBottomWidth: shape.taperBottomWidth,
    taperBottomDepth: shape.taperBottomDepth,
    taperTopScale: shape.taperTopScale,
    taperBottomScale: shape.taperBottomScale,
    teeth: shape.teeth,
    toothSize: shape.toothSize,
    toothWidth: shape.toothWidth,
    centerHoleSize: shape.centerHoleSize,
    gearType: shape.gearType,
    helixAngle: shape.helixAngle,
    helixQuality: shape.helixQuality,
    threadMode: shape.threadMode,
    threadFamily: shape.threadFamily,
    threadPreset: shape.threadPreset,
    threadPitch: shape.threadPitch,
    threadDepth: shape.threadDepth,
    threadHandedness: shape.threadHandedness,
    threadQuality: shape.threadQuality,
    boreDiameter: shape.boreDiameter,
    shaftDiameter: shape.shaftDiameter,
    headHeight: shape.headHeight,
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
    bentTubeSegments: shape.bentTubeSegments?.map((segment) => ({ ...segment })),
    text: shape.text,
    font: shape.font,
    importedMesh: shape.importedMesh,
    imagePlate: shape.imagePlate,
    sketchProfile: shape.sketchProfile,
    sketchOperation: shape.sketchOperation,
    sketchRevolve: shape.sketchRevolve,
    groupedShapes: shape.groupedShapes,
    groupedBaseWidth: shape.groupedBaseWidth,
    groupedBaseDepth: shape.groupedBaseDepth,
    groupedBaseHeight: shape.groupedBaseHeight,
    groupOperation: shape.groupOperation,
    locked: shape.locked ?? false,
    hidden: shape.hidden ?? false,
  });
}

export function makeShapeFromAsset(
  asset: ShapeAsset,
  point?: { x: number; z: number; elevation?: number },
  customization: ShapeCustomization = {},
): WorkplaneShape {
  const defaults = shapeAssetDefaultDimensions(asset.kind);
  const width = customization.width ?? defaults.width;
  const depth = customization.depth ?? defaults.depth;
  const height = customization.height ?? defaults.height;
  const size = Math.max(width, depth);
  const gearTeeth = asset.kind === "gear" ? normalizeGearTeeth(customization.teeth ?? DEFAULT_GEAR_TEETH) : undefined;
  const gearToothSize = asset.kind === "gear" ? normalizeGearToothSize(customization.toothSize ?? DEFAULT_GEAR_TOOTH_SIZE, width, depth) : undefined;
  const special = shapeAssetSpecialDefaults(asset.kind, { width, depth, height });

  return {
    id: createLocalId(asset.id),
    name: asset.name,
    kind: asset.kind,
    color: asset.color,
    hole: asset.hole,
    x: point?.x ?? 0,
    z: point?.z ?? 0,
    elevation: point?.elevation ?? 0,
    size,
    width,
    depth,
    height,
    rotation: 0,
    rotationX: 0,
    rotationZ: 0,
    radius: asset.kind === "box" ? 0 : undefined,
    text: asset.kind === "text" ? customization.text ?? "TEXT" : undefined,
    font: asset.kind === "text" ? customization.font ?? "Multilanguage" : undefined,
    steps: asset.kind === "box" ? 10 : asset.kind === "sphere" ? customization.steps ?? 24 : asset.kind === "halfSphere" ? customization.steps ?? 32 : undefined,
    sides: asset.kind === "cylinder" || asset.kind === "cone" ? customization.sides ?? 96 : asset.kind === "roundRoof" ? customization.sides ?? 64 : asset.kind === "pyramid" ? customization.sides ?? 4 : undefined,
    bevel: asset.kind === "cylinder" ? 0 : asset.kind === "tube" || asset.kind === "ring" ? customization.bevel ?? 4 : asset.kind === "text" ? customization.bevel : undefined,
    segments: asset.kind === "cylinder" ? 1 : asset.kind === "text" ? customization.segments : undefined,
    topRadius: asset.kind === "cone" ? customization.topRadius ?? 0 : undefined,
    baseRadius: asset.kind === "cone" ? customization.baseRadius ?? width / 2 : undefined,
    teeth: gearTeeth,
    toothSize: gearToothSize,
    toothWidth: asset.kind === "gear" && customization.toothWidth !== undefined
      ? normalizeGearToothWidth(customization.toothWidth, width, depth, gearTeeth)
      : undefined,
    centerHoleSize: asset.kind === "gear" ? normalizeGearCenterHoleSize(customization.centerHoleSize ?? DEFAULT_GEAR_CENTER_HOLE_SIZE, width, depth, gearToothSize) : undefined,
    gearType: asset.kind === "gear" ? normalizeGearType(customization.gearType ?? DEFAULT_GEAR_TYPE) : undefined,
    helixAngle: asset.kind === "gear" ? normalizeGearHelixAngle(customization.helixAngle ?? DEFAULT_GEAR_HELIX_ANGLE) : undefined,
    helixQuality: asset.kind === "gear" ? normalizeGearHelixQuality(customization.helixQuality ?? DEFAULT_GEAR_HELIX_QUALITY) : undefined,
    threadMode: customization.threadMode ?? special.threadMode ?? (asset.kind === "cylinder" ? "none" : undefined),
    threadFamily: customization.threadFamily ?? special.threadFamily,
    threadPreset: customization.threadPreset ?? special.threadPreset,
    threadPitch: customization.threadPitch ?? special.threadPitch,
    threadDepth: customization.threadDepth ?? special.threadDepth,
    threadHandedness: customization.threadHandedness ?? special.threadHandedness,
    threadQuality: customization.threadQuality ?? special.threadQuality,
    boreDiameter: customization.boreDiameter ?? special.boreDiameter,
    shaftDiameter: customization.shaftDiameter ?? special.shaftDiameter,
    headHeight: customization.headHeight ?? special.headHeight,
    cornerFillet: customization.cornerFillet ?? special.cornerFillet,
    topBottomFillet: customization.topBottomFillet ?? special.topBottomFillet,
    roundedBoxQuality: customization.roundedBoxQuality ?? special.roundedBoxQuality,
    starPoints: customization.starPoints ?? special.starPoints,
    starInnerSize: customization.starInnerSize ?? special.starInnerSize,
    starOuterFillet: customization.starOuterFillet ?? special.starOuterFillet,
    starInnerFillet: customization.starInnerFillet ?? special.starInnerFillet,
    starQuality: customization.starQuality ?? special.starQuality,
    heartTipFillet: customization.heartTipFillet ?? special.heartTipFillet,
    heartQuality: customization.heartQuality ?? special.heartQuality,
    crescentThickness: customization.crescentThickness ?? special.crescentThickness,
    crescentTipFillet: customization.crescentTipFillet ?? special.crescentTipFillet,
    crescentQuality: customization.crescentQuality ?? special.crescentQuality,
    screwHoleShaft: customization.screwHoleShaft ?? special.screwHoleShaft,
    screwHoleHeadDepth: customization.screwHoleHeadDepth ?? special.screwHoleHeadDepth,
    screwHoleAngle: customization.screwHoleAngle ?? special.screwHoleAngle,
    dovetailNeckWidth: customization.dovetailNeckWidth ?? special.dovetailNeckWidth,
    dovetailClearance: customization.dovetailClearance ?? special.dovetailClearance,
    springTurns: customization.springTurns ?? special.springTurns,
    springWire: customization.springWire ?? special.springWire,
    springQuality: customization.springQuality ?? special.springQuality,
    honeycombCellSize: customization.honeycombCellSize ?? special.honeycombCellSize,
    honeycombWallThickness: customization.honeycombWallThickness ?? special.honeycombWallThickness,
    honeycombFrameWidth: customization.honeycombFrameWidth ?? special.honeycombFrameWidth,
    bentTubeSize: customization.bentTubeSize ?? special.bentTubeSize,
    bentTubeWall: customization.bentTubeWall ?? special.bentTubeWall,
    bentTubeQuality: customization.bentTubeQuality ?? special.bentTubeQuality,
    bentTubeSegments: (customization.bentTubeSegments ?? special.bentTubeSegments)?.map((segment) => ({ ...segment })),
    locked: false,
    hidden: false,
  };
}
