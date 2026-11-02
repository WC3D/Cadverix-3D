"use client";
import { useEffect, useId, useRef, type ComponentType, type SVGProps } from "react";
import { ChevronDown } from "lucide-react";
import { useToolbarMenuPosition } from "./useToolbarMenuPosition";

export type ToolbarMenuTool = { label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; action: () => void; enabled: boolean; active?: boolean };

export function ToolbarToolMenu({ label, icon: Icon, tools, open, onOpenChange }: {
  label: string; icon: ToolbarMenuTool["icon"]; tools: ToolbarMenuTool[];
  open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const owner = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const position = useToolbarMenuPosition(open, owner, 300);
  useEffect(() => {
    if (open && position.visibility === "visible") panel.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [open, position.visibility]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!owner.current?.contains(event.target as Node)) onOpenChange(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, onOpenChange]);
  const active = tools.some((tool) => tool.active);
  return <div className="toolbar-tool-menu" ref={owner} onBlur={(event) => {
    if (open && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) onOpenChange(false);
  }} onKeyDown={(event) => {
    if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation(); onOpenChange(false); trigger.current?.focus();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (!open) { onOpenChange(true); return; }
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowUp" ? (index - 1 + buttons.length) % buttons.length : (index + 1) % buttons.length;
      buttons[next]?.focus();
    }
  }}>
    <button ref={trigger} type="button" className={`toolbar-icon modify-menu-trigger${open || active ? " active" : ""}`} aria-label={`${label} tools`} title={`${label} tools`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => onOpenChange(!open)}>
      <Icon aria-hidden="true" /><span>{label}</span><ChevronDown className="modify-menu-caret" aria-hidden="true" />
    </button>
    {open ? <div ref={panel} id={id} className="modify-tool-dropdown" role="dialog" aria-label={`${label} tools`} style={position}>
      {tools.map(({ label: name, icon: ToolIcon, action, enabled, active }) => <button key={name} type="button" className={`toolbar-icon modify-tool-option${active ? " active" : ""}`} aria-label={name} aria-pressed={active === undefined ? undefined : active} disabled={!enabled} data-sketchforge-tool={name === "Fillet" ? "fillet" : undefined} onClick={() => { onOpenChange(false); trigger.current?.focus(); action(); }}>
        <ToolIcon aria-hidden="true" /><span>{name}</span>
      </button>)}
    </div> : null}
  </div>;
}
