// Adapted from henmedia/layerling commandSearch.ts (AGPL-3.0), f3092321.
export type SearchableCommand = { id: string; label: string; group: string; keywords?: string; enabled?: boolean };
const fold = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function searchCommands<T extends SearchableCommand>(commands: T[], query: string): T[] {
  const words = fold(query).trim().split(/\s+/).filter(Boolean);
  return commands.map((command, index) => {
    const label = fold(command.label), text = fold(`${command.label} ${command.group} ${command.keywords ?? ""}`);
    const score = words.every((word) => text.includes(word)) ? words.reduce((sum, word) => sum + (label.startsWith(word) ? 3 : label.includes(word) ? 2 : 1), 0) : -1;
    return { command, index, score };
  }).filter((entry) => entry.score >= 0).sort((a, b) => b.score - a.score || Number(b.command.enabled !== false) - Number(a.command.enabled !== false) || a.index - b.index).map((entry) => entry.command);
}
