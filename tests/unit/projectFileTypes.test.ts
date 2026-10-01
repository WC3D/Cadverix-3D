import { describe, expect, it } from "vitest";
import { editableProjectFileName } from "@/lib/projectFileTypes";

describe("editableProjectFileName", () => {
  it.each([
    ["part.skf", true],
    ["part.SKF", true],
    ["part.lyl", true],
    ["part.LYL", true],
    ["part.lyl.zip", false],
    ["part.stl", false],
  ])("classifies %s", (name, expected) => {
    expect(editableProjectFileName(name)).toBe(expected);
  });
});
