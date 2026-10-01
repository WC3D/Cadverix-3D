import type { AppTheme } from "@/lib/themes";
import type { ConstructionPlaneAttachment, ConstructionPlanePose, PrincipalPlane, Vector3Tuple } from "@/lib/constructionPlanes";

export type ShapeKind =
  | "box"
  | "cylinder"
  | "sphere"
  | "sketch"
  | "scribble"
  | "cone"
  | "pyramid"
  | "roof"
  | "text"
  | "roundRoof"
  | "halfSphere"
  | "torus"
  | "tube"
  | "gear"
  | "screw"
  | "washer"
  | "nut"
  | "roundedBox"
  | "ellipse"
  | "slot"
  | "star"
  | "heart"
  | "crescent"
  | "teardrop"
  | "counterbore"
  | "countersink"
  | "dovetail"
  | "spring"
  | "honeycomb"
  | "bentTube"
  | "ring"
  | "wedge"
  | "polygon"
  | "icosahedron"
  | "constructionPlane"
  | "mesh";

export type ShapeAsset = {
  id: string;
  name: string;
  src: string;
  kind: ShapeKind;
  color: string;
  hole?: boolean;
};

export type BentTubeSegment = { length: number; bendAngle: number; bendRadius: number; roll: number };

export type ProjectAssetSourceFormat = "stl" | "3mf" | "obj" | "svg" | "step";

export type ProjectAsset = {
  id: string;
  name: string;
  mediaType: string;
  sourceFormat: ProjectAssetSourceFormat;
  bytes: Uint8Array;
  byteLength: number;
  sha256: string;
};

export type GridSize = "Off" | "0.1 mm" | "0.25 mm" | "0.5 mm" | "1.0 mm" | "2.0 mm" | "5.0 mm"
  | "1/64 in" | "1/32 in" | "1/16 in" | "1/8 in" | "1/4 in" | "1/2 in" | "1 in" | "Brick";
export type MeasurementAccuracy = 1 | 2 | 3;
export type HistoryRetentionLimit = "unlimited" | number;
export type ThreadMode = "none" | "external" | "internal";
export type ThreadHandedness = "right" | "left";
export type ThreadFamily = "metric" | "unc" | "unf" | "custom";

export type ShapeCustomization = {
  width?: number;
  depth?: number;
  height?: number;
  maxDimension?: number;
  steps?: number;
  sides?: number;
  bevel?: number;
  segments?: number;
  topRadius?: number;
  baseRadius?: number;
  teeth?: number;
  toothSize?: number;
  toothWidth?: number;
  centerHoleSize?: number;
  gearType?: GearType;
  helixAngle?: number;
  helixQuality?: number;
  threadMode?: ThreadMode;
  threadFamily?: ThreadFamily;
  threadPreset?: string;
  threadPitch?: number;
  threadDepth?: number;
  threadHandedness?: ThreadHandedness;
  threadQuality?: number;
  boreDiameter?: number;
  shaftDiameter?: number;
  headHeight?: number;
  cornerFillet?: number;
  topBottomFillet?: number;
  roundedBoxQuality?: number;
  starPoints?: number;
  starInnerSize?: number;
  starOuterFillet?: number;
  starInnerFillet?: number;
  starQuality?: number;
  heartTipFillet?: number;
  heartQuality?: number;
  crescentThickness?: number;
  crescentTipFillet?: number;
  crescentQuality?: number;
  screwHoleShaft?: number;
  screwHoleHeadDepth?: number;
  screwHoleAngle?: number;
  dovetailNeckWidth?: number;
  dovetailClearance?: number;
  springTurns?: number;
  springWire?: number;
  springQuality?: number;
  honeycombCellSize?: number;
  honeycombWallThickness?: number;
  honeycombFrameWidth?: number;
  bentTubeSize?: number;
  bentTubeWall?: number;
  bentTubeQuality?: number;
  bentTubeSegments?: BentTubeSegment[];
  text?: string;
  font?: string;
};

export type ShapeCustomizationMap = Partial<Record<ShapeKind, ShapeCustomization>>;

export type WorkplaneWorkspaceSettings = {
  width: number;
  depth: number;
  sizePreset: string;
  gridBlockSize: number;
  gridBlockPreset: string;
  gridColor: string;
  background: string;
  themeId?: string;
  customTheme?: AppTheme;
  showShadows: boolean;
  showGrid: boolean;
  cruiseShapes: boolean;
  selectBeforeMove: boolean;
  zoomSpeed: number;
  units: string;
  scale: string;
  accuracy: MeasurementAccuracy;
  historyLimit: HistoryRetentionLimit;
  shapeCustomizations: ShapeCustomizationMap;
};

export type AlignAxis = "x" | "y" | "z";
export type AlignTarget = "min" | "center" | "max";
export type AlignHandleStatus = {
  axis: AlignAxis;
  target: AlignTarget;
  disabled: boolean;
  aligned: boolean;
  title: string;
};

export type SketchPoint = {
  id: string;
  x: number;
  z: number;
  handleIn?: { x: number; z: number };
  handleOut?: { x: number; z: number };
  mode?: "corner" | "smooth" | "split";
  projectionId?: string;
};

export type SketchSegment = {
  id: string;
  startId: string;
  endId: string;
  kind?: "line" | "bezier" | "smooth";
  dimensionLabelOffset?: { x: number; z: number };
  projectionId?: string;
};

export type SketchProjectionLink = {
  id: string;
  sourceShapeId: string;
  sourceName: string;
  sourceKind: "sketch" | "intersection";
};

export type SketchConstraint =
  | { id: string; kind: "horizontal" | "vertical"; segmentId: string }
  | { id: string; kind: "fixed"; pointId: string; x: number; z: number };

export type SketchDimensionAnchor =
  | { kind: "point"; pointId: string }
  | { kind: "midpoint"; segmentId: string }
  | { kind: "intersection"; firstSegmentId: string; secondSegmentId: string; index: number };

export type SketchDimension =
  | { id: string; kind: "length"; segmentId: string; value: number }
  | { id: string; kind: "distance"; start: SketchDimensionAnchor; end: SketchDimensionAnchor };

export type SketchImage = {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
  pixelWidth: number;
  pixelHeight: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  opacity?: number;
  lockAspect?: boolean;
  locked?: boolean;
};

export type SketchText = {
  id: string;
  text: string;
  x: number;
  z: number;
  fontSize: number;
};

export type SketchProfile = {
  points: SketchPoint[];
  segments: SketchSegment[];
  constraints?: SketchConstraint[];
  dimensions?: SketchDimension[];
  images?: SketchImage[];
  texts?: SketchText[];
  projections?: SketchProjectionLink[];
};

export type SketchFeature =
  | { kind: "extrusion"; regionIds?: string[] }
  | { kind: "sweep"; sectionSegmentIds: string[]; pathSegmentIds: string[] };

export type ConstructionPlaneDefinition =
  | { kind: "principal"; principal: PrincipalPlane; offset: number; angle?: number; flipped?: boolean; pose: ConstructionPlanePose }
  | { kind: "face"; sourceShapeId: string; attachment: ConstructionPlaneAttachment; offset?: number; angle?: number; flipped?: boolean; pose: ConstructionPlanePose }
  | { kind: "angle"; referencePlaneId: string; angle: number; offset?: number; flipped?: boolean; pose: ConstructionPlanePose }
  | { kind: "midplane"; firstPlaneId: string; secondPlaneId: string; offset?: number; pose: ConstructionPlanePose };

export type SketchPlaneAttachment = {
  constructionPlaneId: string;
  pose: ConstructionPlanePose;
  localCenter: Vector3Tuple;
};

export type SketchOperation = "extrude" | "revolve";
export type ShapeFeatureKind = "edge" | "sculpt" | "sketch" | "group";

export type GearType = "spur" | "helical" | "bevel";

export type SketchRevolveSettings = {
  startAngle: number;
  sweepAngle: number;
  sides: number;
  quality: number;
};

export type EdgeTreatmentFeature = {
  kind: "fillet" | "chamfer";
  amount: number;
  edgeCount: number;
  chamferAngle?: number;
};

export type EdgeTreatmentHistoryEntry = {
  id: string;
  createdAt: number;
  feature: EdgeTreatmentFeature;
  before: WorkplaneShape;
  appliedFrame?: {
    x: number;
    z: number;
    elevation: number;
    width: number;
    depth: number;
    height: number;
    rotation: number;
    rotationX: number;
    rotationZ: number;
    mirrorX: boolean;
    mirrorY: boolean;
    mirrorZ: boolean;
  };
};

export type CadDisplayEdge = {
  points: number[];
};

export type CadBrepFrame = {
  x: number;
  z: number;
  elevation: number;
  width: number;
  depth: number;
  height: number;
  sourceTransform?: number[];
};

export type CadPrimitiveFrame = {
  kind: "box";
  width: number;
  depth: number;
  height: number;
  frame: CadBrepFrame;
};

export type WorkplaneShape = {
  id: string;
  name: string;
  kind: ShapeKind;
  color: string;
  hole?: boolean;
  x: number;
  z: number;
  elevation?: number;
  size: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  rotationX?: number;
  rotationZ?: number;
  mirrorX?: boolean;
  mirrorY?: boolean;
  mirrorZ?: boolean;
  radius?: number;
  steps?: number;
  sides?: number;
  bevel?: number;
  segments?: number;
  topRadius?: number;
  baseRadius?: number;
  taperTopWidth?: number;
  taperTopDepth?: number;
  taperBottomWidth?: number;
  taperBottomDepth?: number;
  /** Legacy local-dev taper fields kept for compatibility with in-progress projects. */
  taperTopScale?: number;
  taperBottomScale?: number;
  teeth?: number;
  toothSize?: number;
  toothWidth?: number;
  centerHoleSize?: number;
  gearType?: GearType;
  helixAngle?: number;
  helixQuality?: number;
  threadMode?: ThreadMode;
  threadFamily?: ThreadFamily;
  threadPreset?: string;
  threadPitch?: number;
  threadDepth?: number;
  threadHandedness?: ThreadHandedness;
  threadQuality?: number;
  boreDiameter?: number;
  shaftDiameter?: number;
  headHeight?: number;
  cornerFillet?: number;
  topBottomFillet?: number;
  roundedBoxQuality?: number;
  starPoints?: number;
  starInnerSize?: number;
  starOuterFillet?: number;
  starInnerFillet?: number;
  starQuality?: number;
  heartTipFillet?: number;
  heartQuality?: number;
  crescentThickness?: number;
  crescentTipFillet?: number;
  crescentQuality?: number;
  screwHoleShaft?: number;
  screwHoleHeadDepth?: number;
  screwHoleAngle?: number;
  dovetailNeckWidth?: number;
  dovetailClearance?: number;
  springTurns?: number;
  springWire?: number;
  springQuality?: number;
  honeycombCellSize?: number;
  honeycombWallThickness?: number;
  honeycombFrameWidth?: number;
  bentTubeSize?: number;
  bentTubeWall?: number;
  bentTubeQuality?: number;
  bentTubeSegments?: BentTubeSegment[];
  text?: string;
  font?: string;
  importedMesh?: {
    positions: number[];
    normals?: number[];
    baseWidth: number;
    baseDepth: number;
    baseHeight: number;
    triangleCount: number;
    sourceFormat: "stl" | "3mf" | "obj" | "svg" | "json" | "step";
    // IndexedDB persistence uses this only in compact stored shape records.
    // Runtime editor shapes are hydrated with the full immutable mesh resource.
    storageResourceId?: string;
    // Stable reference to the original imported file in the project's shared
    // asset table. Copies and grouped operands reuse this reference.
    assetId?: string;
    // Exact OpenCascade B-Rep of the body (single-shape STEP text) in the same
    // local frame as `positions`. Set only for STEP imports; lets the exporter
    // re-emit the original analytic geometry instead of the tessellation.
    brepStep?: string;
  };
  imagePlate?: {
    dataUrl: string;
    mimeType: string;
    pixelWidth: number;
    pixelHeight: number;
  };
  sketchProfile?: SketchProfile;
  sketchFeature?: SketchFeature;
  constructionPlane?: ConstructionPlaneDefinition;
  sketchPlane?: SketchPlaneAttachment;
  sketchOperation?: SketchOperation;
  sketchRevolve?: SketchRevolveSettings;
  sculpted?: boolean;
  sculptSource?: WorkplaneShape;
  disabledFeatures?: ShapeFeatureKind[];
  edgeTreatments?: EdgeTreatmentFeature[];
  edgeTreatmentHistory?: EdgeTreatmentHistoryEntry[];
  cadDisplayEdges?: CadDisplayEdge[];
  cadDisplayEdgesVersion?: 2;
  edgeResizeMode?: "scale" | "preserve";
  cadBrep?: string;
  cadBrepFrame?: CadBrepFrame;
  cadPrimitiveFrame?: CadPrimitiveFrame;
  groupedShapes?: WorkplaneShape[];
  groupedBaseWidth?: number;
  groupedBaseDepth?: number;
  groupedBaseHeight?: number;
  groupOperation?: "group" | "intersection";
  locked?: boolean;
  hidden?: boolean;
};
