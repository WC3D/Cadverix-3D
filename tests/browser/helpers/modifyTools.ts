import type { Page } from "@playwright/test";
import { MODIFY_TOOL_GROUPS } from "../../../apps/web/src/lib/modifyToolGroups";

export async function chooseModifyTool(page: Page, label: string, touch = false) {
  const group = MODIFY_TOOL_GROUPS.find((group) => group.tools.some((tool) => tool === label));
  if (!group) throw new Error(`No Modify menu contains ${label}`);
  const trigger = page.getByRole("button", { name: `${group.label} tools`, exact: true });
  if (await trigger.getAttribute("aria-expanded") !== "true") {
    if (touch) await trigger.tap(); else await trigger.click();
  }
  const tool = page.getByRole("dialog", { name: `${group.label} tools`, exact: true }).getByRole("button", { name: label, exact: true });
  if (touch) await tool.tap(); else await tool.click();
}
