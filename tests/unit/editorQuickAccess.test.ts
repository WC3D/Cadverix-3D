import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorQuickAccess } from "@/components/EditorQuickAccess";
import { THEME_PRESET_OPTIONS } from "@/lib/themes";

describe("editor quick access", () => {
  it("uses the workspace theme presets and marks the current theme", () => {
    const html = renderToStaticMarkup(createElement(EditorQuickAccess, { themeId: "inventor", onThemeChange: () => {} }));
    for (const option of THEME_PRESET_OPTIONS) expect(html).toContain(`value="${option.value}"`);
    expect(html).toContain('value="inventor" selected=""');
    expect(html).toContain('aria-label="Quick theme"');
  });

  it("links documentation, guides, shortcuts and support without replacing the editor", () => {
    const html = renderToStaticMarkup(createElement(EditorQuickAccess, { themeId: "sketchforge", onThemeChange: () => {} }));
    expect(html).toContain("/docs/CADVERIX_USER_MANUAL.md\"");
    expect(html).toContain("/tree/main/docs");
    expect(html).toContain("#11-complete-keyboard-shortcut-reference");
    expect(html).toContain("/issues");
    expect(html.match(/target="_blank" rel="noopener noreferrer"/g)).toHaveLength(4);
  });
});
