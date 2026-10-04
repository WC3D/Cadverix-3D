import { transformSketchSelection, translationTransform, type SketchTransformSelection } from "@/lib/sketchTransforms";
import type { SketchProfile } from "@/types/sketchforge";

export function copySketchSelection(profile: SketchProfile, selection: SketchTransformSelection): SketchProfile {
  const copied = transformSketchSelection(profile, selection, [translationTransform(0, 0)]).profile;
  return {
    points: copied.points.slice(profile.points.length).map((point) => ({ ...point, projectionId: undefined })),
    segments: copied.segments.slice(profile.segments.length).map((segment) => ({ ...segment, projectionId: undefined })),
    constraints: copied.constraints?.slice(profile.constraints?.length ?? 0),
    dimensions: copied.dimensions?.slice(profile.dimensions?.length ?? 0),
    images: copied.images?.slice(profile.images?.length ?? 0),
    texts: copied.texts?.slice(profile.texts?.length ?? 0),
  };
}

export function pasteSketchSelection(target: SketchProfile, clipboard: SketchProfile) {
  const bounds = (profile: SketchProfile) => [
    ...profile.points.map((point) => point.x),
    ...(profile.images ?? []).flatMap((image) => [image.x - image.width / 2, image.x + image.width / 2]),
    ...(profile.texts ?? []).map((text) => text.x + text.fontSize * text.text.length),
  ];
  const sourceX = bounds(clipboard), targetX = bounds(target);
  const shift = targetX.length && sourceX.length ? Math.max(...targetX) - Math.min(...sourceX) + 5 : 5;
  const selection = { pointIds: clipboard.points.map((p) => p.id), segmentIds: clipboard.segments.map((s) => s.id), imageIds: (clipboard.images ?? []).map((i) => i.id), textIds: (clipboard.texts ?? []).map((t) => t.id) };
  const result = transformSketchSelection(clipboard, selection, [translationTransform(shift, 0)]);
  return { selection: result.selection, profile: {
    ...target,
    points: [...target.points, ...result.profile.points.slice(clipboard.points.length)],
    segments: [...target.segments, ...result.profile.segments.slice(clipboard.segments.length)],
    constraints: [...(target.constraints ?? []), ...(result.profile.constraints ?? []).slice(clipboard.constraints?.length ?? 0)],
    dimensions: [...(target.dimensions ?? []), ...(result.profile.dimensions ?? []).slice(clipboard.dimensions?.length ?? 0)],
    images: [...(target.images ?? []), ...(result.profile.images ?? []).slice(clipboard.images?.length ?? 0)],
    texts: [...(target.texts ?? []), ...(result.profile.texts ?? []).slice(clipboard.texts?.length ?? 0)],
  } };
}
