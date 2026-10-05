import type { CSSProperties, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
type SpriteRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const toolbarSprite = "assets/sketchforge/toolbar-sprite.svg?v=2";
const vectorToolbarSprite = "assets/sketchforge/vector-toolbar-icons.svg?v=1";

function ToolbarSpriteIcon({ rect, className, style }: IconProps & { rect: SpriteRect }) {
  const size = 35;
  const scale = size / rect.height;

  return (
    <span
      aria-hidden="true"
      className={["toolbar-sprite-icon", className].filter(Boolean).join(" ")}
      style={
        {
          "--sprite-x": `${-rect.x * scale}px`,
          "--sprite-y": `${-rect.y * scale}px`,
          "--sprite-width": `${260 * scale}px`,
          "--sprite-height": `${80 * scale}px`,
          width: `${rect.width * scale}px`,
          height: `${size}px`,
          backgroundImage: `url(${toolbarSprite})`,
          ...(style as CSSProperties),
        } as CSSProperties
      }
    />
  );
}

function VectorToolbarSpriteIcon({ rect, className, style }: IconProps & { rect: SpriteRect }) {
  const size = 35;
  const scale = size / rect.height;

  return (
    <span
      aria-hidden="true"
      className={["vector-toolbar-sprite-icon", className].filter(Boolean).join(" ")}
      style={
        {
          "--vector-sprite-x": `${-rect.x * scale}px`,
          "--vector-sprite-y": `${-rect.y * scale}px`,
          "--vector-sprite-width": `${165 * scale}px`,
          "--vector-sprite-height": `${27 * scale}px`,
          width: `${rect.width * scale}px`,
          height: `${size}px`,
          backgroundImage: `url(${vectorToolbarSprite})`,
          ...(style as CSSProperties),
        } as CSSProperties
      }
    />
  );
}

type ToolbarCommandImageProps = { file: string; className?: string };

function ToolbarCommandImage({ file, className }: ToolbarCommandImageProps) {
  const assetClassName = `toolbar-art-${file.replace(/\.png$/i, "")}`;
  return <img aria-hidden="true" className={["toolbar-command-icon", assetClassName, className].filter(Boolean).join(" ")} src={"/assets/sketchforge/" + file} alt="" draggable={false} />;
}

export function ToolbarHomeIcon() {
  return <ToolbarCommandImage file="toolbar-home.png" className="toolbar-user-art-icon" />;
}

export function ToolbarCopyIcon() {
  return <ToolbarCommandImage file="toolbar-copy.png" className="toolbar-user-art-icon" />;
}

export function ToolbarPasteIcon() {
  return <ToolbarCommandImage file="toolbar-paste.png" className="toolbar-user-art-icon" />;
}

export function ToolbarDuplicateIcon() {
  return <ToolbarCommandImage file="toolbar-duplicate.png" className="toolbar-user-art-icon" />;
}

export function ToolbarTrashIcon() {
  return <ToolbarCommandImage file="toolbar-delete.png" className="toolbar-user-art-icon" />;
}

export function ToolbarUndoIcon() {
  return <ToolbarCommandImage file="toolbar-undo.png" className="toolbar-user-art-icon" />;
}

export function ToolbarRedoIcon() {
  return <ToolbarCommandImage file="toolbar-redo.png" className="toolbar-user-art-icon" />;
}

export function ToolbarImportIcon() {
  return (
    <svg className="toolbar-vector-art-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 28v10a3 3 0 0 0 3 3h26a3 3 0 0 0 3-3V28" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" />
      <path d="M24 7v23m0 0-8-8m8 8 8-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ToolbarVectorExportIcon() {
  return (
    <svg className="toolbar-vector-art-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 28v10a3 3 0 0 0 3 3h26a3 3 0 0 0 3-3V28" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" />
      <path d="M24 31V8m0 0-8 8m8-8 8 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ToolbarSettingsIcon() {
  return (
    <svg className="toolbar-vector-art-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M20 7h8l1.3 5.1 4 2.3 5-1.4 4 6.9-3.8 3.7v4.7l3.8 3.7-4 6.9-5-1.4-4 2.3L28 45h-8l-1.3-5.1-4-2.3-5 1.4-4-6.9 3.8-3.7v-4.7L5.7 20l4-6.9 5 1.4 4-2.3L20 7Z" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round" />
      <circle cx="24" cy="26" r="6" fill="none" stroke="currentColor" strokeWidth="2.7" />
    </svg>
  );
}

export function ToolbarNoteIcon() {
  return (
    <svg className="toolbar-vector-art-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M11 7h17l9 9v25H11a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3Z" fill="#fff4a8" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M28 7v9h9M15 25h15M15 32h11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ToolbarShapeAddIcon(props: IconProps) {
  return <VectorToolbarSpriteIcon rect={{ x: 104, y: 0, width: 29, height: 27 }} {...props} />;
}

export function ToolbarHideSelectedIcon(props: IconProps) {
  return <VectorToolbarSpriteIcon rect={{ x: 138, y: 0, width: 27, height: 27 }} {...props} />;
}

export function ToolbarCaretDownIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path d="m16 19 8 9 8-9z" fill="currentColor" />
    </svg>
  );
}

export function ToolbarGroupIcon() {
  return <ToolbarCommandImage file="toolbar-group.png" />;
}

export function ToolbarUngroupIcon() {
  return <ToolbarCommandImage file="toolbar-ungroup.png" />;
}

export function ToolbarIntersectionIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <circle cx="19" cy="24" r="13" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="29" cy="24" r="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="4 3" />
      <path d="M24 11.99A13 13 0 0 1 24 36.01A13 13 0 0 1 24 11.99Z" fill="currentColor" opacity="0.82" />
    </svg>
  );
}

export function ToolbarBodiesSplitIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path d="M7 13h13v22H7zM28 13h13v22H28z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M24 10v28" fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="3 3" strokeLinecap="round" />
      <path d="m17 24-5-4v8l5-4Zm14 0 5-4v8l-5-4Z" fill="currentColor" />
    </svg>
  );
}

export function ToolbarAlignIcon(props: IconProps) {
  return <ToolbarSpriteIcon rect={{ x: 97.3, y: 46.7, width: 29.1, height: 32.5 }} {...props} />;
}

export function ToolbarMirrorIcon() {
  return <ToolbarCommandImage file="toolbar-mirror.png" className="toolbar-user-art-icon" />;
}

export function ToolbarSplitIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path d="m11 17 13-7 13 7-13 7-13-7Z" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round" />
      <path d="m11 31 13 7 13-7" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round" />
      <path d="M8 24h32" fill="none" stroke="currentColor" strokeWidth="2.7" strokeDasharray="4 3" strokeLinecap="round" />
      <path d="m11 17v4m26-4v4M11 27v4m26-4v4" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}

export function ToolbarChamferIcon() {
  return <ToolbarCommandImage file="toolbar-chamfer.png" className="toolbar-user-art-icon" />;
}

export function ToolbarFilletIcon() {
  return <ToolbarCommandImage file="toolbar-fillet.png" className="toolbar-user-art-icon" />;
}

export function ToolbarPreserveEdgeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path d="M10 35V17c0-4 3-7 7-7h18" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" />
      <path d="M10 35h25V10" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinejoin="round" />
      <path d="M17 29h13M17 25v8M30 25v8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M18 17a7 7 0 0 1 7-7" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function ToolbarSnapGridIcon() {
  return <ToolbarCommandImage file="toolbar-snap-grid.png" className="toolbar-user-art-icon" />;
}

export function ToolbarExportIcon() {
  return <ToolbarCommandImage file="toolbar-export.png" className="toolbar-user-art-icon" />;
}

export function ToolbarWorkplaneIcon() {
  return <ToolbarCommandImage file="toolbar-workplane.png" className="toolbar-user-art-icon" />;
}

export function ToolbarDropToWorkplaneIcon() {
  return <ToolbarCommandImage file="toolbar-drop-workplane.png" className="toolbar-user-art-icon" />;
}

export function ToolbarCenterOnWorkplaneIcon({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={["toolbar-vector-art-icon", className].filter(Boolean).join(" ")}
      {...props}
    >
      <rect x="5" y="5" width="38" height="38" rx="3.5" fill="#efeded" stroke="currentColor" strokeWidth="2.6" />
      <rect x="18" y="18" width="12" height="12" rx="1.5" fill="#d0cdcd" stroke="currentColor" strokeWidth="2.4" />
      <path d="M20 8.5h8L24 14Z M20 39.5h8L24 34Z M8.5 20v8L14 24Z M39.5 20v8L34 24Z" fill="currentColor" />
    </svg>
  );
}
