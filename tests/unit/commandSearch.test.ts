import { expect, it } from "vitest";
import { searchCommands } from "@/lib/commandSearch";
it("finds labels, groups and synonyms, ranking usable direct matches first", () => {
  const commands = [{ id: "a", label: "Fillet", group: "Modify", keywords: "round edges" }, { id: "b", label: "Fillet", group: "Modify", enabled: false }, { id: "c", label: "Round box", group: "Shapes" }];
  expect(searchCommands(commands, "round edges").map((entry) => entry.id)).toEqual(["a"]);
  expect(searchCommands(commands, "FILLET").map((entry) => entry.id)).toEqual(["a", "b"]);
  expect(searchCommands(commands, "unknown")).toEqual([]);
});
