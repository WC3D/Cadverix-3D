import { describe, expect, it } from "vitest";
import { formatFractionalInches, parseMeasurementInput } from "@/lib/measurementUnits";
import { snapGridForUnits, snapGridOptionsForUnits, snapGridStep } from "@/lib/workplaneSettings";

describe("imperial measurements", () => {
  it.each([
    ["5/8", 0.625],
    ["1 5/8", 1.625],
    ["1-5/8", 1.625],
    ["1⅝", 1.625],
    ["-¾", -0.75],
    ["7/4", 1.75],
  ])("parses %s", (input, expected) => {
    expect(parseMeasurementInput(input)).toBeCloseTo(expected);
  });

  it("rejects fractions with a zero denominator", () => {
    expect(parseMeasurementInput("1/0")).toBeNaN();
  });

  it.each([
    [0, "0"],
    [1, "1"],
    [1.625, "1 5/8"],
    [-0.75, "-3/4"],
    [1 / 64, "1/64"],
  ])("formats %s inches", (input, expected) => {
    expect(formatFractionalInches(input)).toBe(expected);
  });

  it("provides inch grids with exact millimeter steps", () => {
    expect(snapGridOptionsForUnits("Imperial")).toContain("1/64 in");
    expect(snapGridStep("1/64 in")).toBeCloseTo(25.4 / 64);
    expect(snapGridStep("1 in")).toBe(25.4);
    expect(snapGridForUnits("Imperial", "1.0 mm")).toBe("1/8 in");
    expect(snapGridForUnits("Metric (Default)", "1/8 in")).toBe("1.0 mm");
  });
});
