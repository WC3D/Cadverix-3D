import { expect, it, vi } from "vitest";
import { projectListWithoutPictures, writeProjectList } from "@/lib/projectListStorage";
import { requireUnlockedObjects } from "@/lib/mcpEditSafety";

it("retains the previous list when replacing it exceeds storage quota", () => {
  const values = new Map([["projects", "previous"]]);
  const removeItem = vi.fn();
  const storage = { removeItem, setItem: () => { throw new Error("QuotaExceededError"); } };
  expect(() => writeProjectList(storage, "projects", "next")).toThrow("QuotaExceededError");
  expect(values.get("projects")).toBe("previous");
  expect(removeItem).not.toHaveBeenCalled();
});

it("removes only inline pictures from the localStorage representation", () => {
  const projects = [{ id: "a", thumbnailUrl: "data:image/png;base64,abc" }, { id: "b", thumbnailUrl: "/thumbnail.png" }];
  expect(projectListWithoutPictures(projects)).toEqual([{ id: "a", thumbnailUrl: null }, projects[1]]);
  expect(projects[0].thumbnailUrl).toContain("data:");
});

it("rejects the entire edit when any target is locked", () => {
  expect(() => requireUnlockedObjects([{}, { locked: true }])).toThrow("Unlock");
  expect(() => requireUnlockedObjects([{}, { locked: false }])).not.toThrow();
});
