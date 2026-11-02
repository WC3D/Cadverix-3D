import { BookOpen, CircleHelp, Keyboard, LibraryBig, Palette } from "lucide-react";
import { THEME_PRESET_OPTIONS } from "@/lib/themes";

const REPOSITORY = "https://github.com/WC3D/Cadverix-3D";

export function EditorQuickAccess({ themeId, onThemeChange }: {
  themeId: string;
  onThemeChange: (themeId: string) => void;
}) {
  return <div className="editor-quick-access" role="group" aria-label="Themes and help">
    <label className="quick-theme" title="Change workspace theme">
      <Palette size={18} aria-hidden="true" />
      <select aria-label="Quick theme" value={themeId} onChange={(event) => onThemeChange(event.target.value)}>
        {THEME_PRESET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    <a href={`${REPOSITORY}/blob/main/docs/CADVERIX_USER_MANUAL.md`} target="_blank" rel="noopener noreferrer" aria-label="Documentation (opens in new tab)" title="Documentation"><BookOpen size={18} aria-hidden="true" /></a>
    <a href={`${REPOSITORY}/tree/main/docs`} target="_blank" rel="noopener noreferrer" aria-label="Knowledge base (opens in new tab)" title="Knowledge base and guides"><LibraryBig size={18} aria-hidden="true" /></a>
    <a href={`${REPOSITORY}/blob/main/docs/CADVERIX_USER_MANUAL.md#11-complete-keyboard-shortcut-reference`} target="_blank" rel="noopener noreferrer" aria-label="Keyboard shortcuts (opens in new tab)" title="Keyboard shortcuts"><Keyboard size={18} aria-hidden="true" /></a>
    <a href={`${REPOSITORY}/issues`} target="_blank" rel="noopener noreferrer" aria-label="Support (opens in new tab)" title="Support / report a problem"><CircleHelp size={18} aria-hidden="true" /></a>
  </div>;
}
