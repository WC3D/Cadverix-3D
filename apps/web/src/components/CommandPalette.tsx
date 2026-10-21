"use client";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { searchCommands, type SearchableCommand } from "@/lib/commandSearch";

export function CommandPalette({ commands }: { commands: Array<SearchableCommand & { action: () => void }> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const open = () => { setQuery(""); if (!dialog.current?.open) dialog.current?.showModal(); input.current?.focus(); };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); event.stopPropagation(); open(); }
    };
    window.addEventListener("keydown", keydown, true);
    return () => window.removeEventListener("keydown", keydown, true);
  }, []);
  const ordered = query.trim() ? commands : [...commands].sort((a, b) => {
    const rank = (id: string) => recent.includes(id) ? recent.indexOf(id) : recent.length;
    return rank(a.id) - rank(b.id);
  });
  const results = searchCommands(ordered, query);
  const run = (command: typeof commands[number]) => {
    if (command.enabled === false) return;
    dialog.current?.close(); setRecent((current) => [command.id, ...current.filter((id) => id !== command.id)].slice(0, 5)); command.action();
  };
  return <>
    <button className="command-search-trigger" type="button" aria-label="Search commands" title="Search commands (Ctrl/Cmd+K)" onClick={open}><Search size={18} /></button>
    <dialog ref={dialog} className="command-palette" aria-label="Search commands" onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }} onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>(".command-results button:not(:disabled)") ?? []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "ArrowDown" ? (index + 1) % buttons.length : index <= 0 ? buttons.length - 1 : index - 1;
        buttons[next]?.focus();
      } else if (event.key === "Enter" && event.target === input.current) { event.preventDefault(); const first = results.find((command) => command.enabled !== false); if (first) run(first); }
    }}>
      <header><strong>Search commands</strong><button type="button" aria-label="Close command search" onClick={() => dialog.current?.close()}>Close</button></header>
      <input ref={input} autoFocus aria-label="Find a tool, shape, or command" placeholder="Try fillet, box, mirror…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="command-results">{results.map((command) => <button key={command.id} type="button" disabled={command.enabled === false} onClick={() => run(command)}><span>{command.label}</span><small>{command.group}{command.enabled === false ? " · unavailable in this context" : ""}</small></button>)}{!results.length ? <p role="status">No matching commands</p> : null}</div>
    </dialog>
  </>;
}
