import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { testCircuit, simulationResistance } from "@/pcb/pcbSimulation";
import { parseCircuitScene } from "@/pcb/pcbDocument";
import { PART_BY_KIND } from "@/pcb/vendor/lib/circuitPartsExact";
import type { CircuitPart } from "@/pcb/vendor/components/FunctionalCircuitEditor";

const fixture = JSON.parse(readFileSync("tests/fixtures/pcb-led-switch.sfpcb", "utf8")).scene;
const circuit = () => parseCircuitScene(structuredClone(fixture));
const closed = new Set(["switch"]);
it("opens and closes a real return loop without changing the saved design", () => {
  const scene = circuit(), before = JSON.stringify(scene);
  expect(testCircuit(scene).leds.get("led")?.on).toBe(false);
  const result = testCircuit(scene, closed);
  expect(result.ok).toBe(true); expect(result.warnings).toEqual([]);
  expect(result.leds.get("led")?.on).toBe(true);
  expect(result.leds.get("led")?.currentMa).toBeCloseTo(3.2 / 340 * 1000, 4);
  expect(result.supplyCurrentMa).toBeCloseTo(result.leds.get("led")!.currentMa, 4);
  expect(testCircuit(scene).leds.get("led")?.on).toBe(false);
  expect(JSON.stringify(scene)).toBe(before);
});
it("does not light a reversed LED or a circuit without a return wire", () => {
  const scene = circuit(); scene.wires[2].to.pinId = "1"; scene.wires[3].from.pinId = "2";
  const reversed = testCircuit(scene, closed);
  expect(reversed.ok).toBe(true); expect(reversed.leds.get("led")!.on).toBe(false);
  expect(reversed.warnings.join(" ")).toContain("reverse biased");
  const open = circuit(); open.wires.pop();
  expect(testCircuit(open, closed).leds.get("led")?.on).toBe(false);
});
it("treats the duplicated physical pushbutton pads as the same electrical contacts", () => {
  const scene = circuit(); scene.wires[1].to.pinId = "1b"; scene.wires[2].from.pinId = "2b";
  expect(testCircuit(scene, closed).leds.get("led")?.on).toBe(true);
});
it("reports direct supply shorts, including shorts made by a switch", () => {
  const scene = circuit(); scene.wires.push({ id: "short", from: { partId: "battery", pinId: "1" }, to: { partId: "battery", pinId: "2" } });
  expect(testCircuit(scene).error).toContain("short circuit");
  const switched = circuit(); switched.wires = [
    { id: "a", from: { partId: "battery", pinId: "1" }, to: { partId: "switch", pinId: "1a" } },
    { id: "b", from: { partId: "switch", pinId: "2a" }, to: { partId: "battery", pinId: "2" } },
  ];
  expect(testCircuit(switched).ok).toBe(true);
  expect(testCircuit(switched, closed).error).toContain("short circuit");
});
it("does not join crossing routes unless a junction is explicitly present", () => {
  const scene = circuit(); scene.wires[3].points = [{ x: 250, y: 553 }, { x: 250, y: 0 }, { x: 170.8, y: 0 }];
  expect(testCircuit(scene, closed).ok).toBe(true);
  scene.junctions.push({ id: "crossing", x: 250, y: 40 });
  expect(testCircuit(scene, closed).error).toContain("short circuit");
});
it("solves parallel resistors rather than just checking whether an LED is reachable", () => {
  const scene = circuit(), second: CircuitPart = { ...scene.parts[1], id: "r2", reference: "R2", x: 1100, y: 900 };
  scene.parts.push(second);
  scene.wires.push({ id: "r2a", from: { partId: "resistor", pinId: "1" }, to: { partId: "r2", pinId: "1" } }, { id: "r2b", from: { partId: "resistor", pinId: "2" }, to: { partId: "r2", pinId: "2" } });
  const result = testCircuit(scene, closed);
  expect(result.ok).toBe(true); expect(result.leds.get("led")!.currentMa).toBeCloseTo(3.2 / 175 * 1000, 4);
});
it("warns about LED overcurrent instead of presenting it as a safe working board", () => {
  const scene = circuit(); scene.parts[1].value = "0.01 Ω";
  const result = testCircuit(scene, closed);
  expect(result.leds.get("led")?.overcurrent).toBe(true); expect(result.warnings.join(" ")).toContain("20 mA");
});
it("requires enough voltage for every LED in a series chain", () => {
  const scene = circuit(); scene.parts[3].value = "Blue";
  scene.parts.push({ ...scene.parts[3], id: "led2", reference: "D2", x: 1000 });
  scene.wires[3] = { ...scene.wires[3], from: { partId: "led2", pinId: "1" }, points: [{ x: 974.6, y: 720 }, { x: 30, y: 720 }, { x: 30, y: 260 }, { x: 170.8, y: 260 }] };
  scene.wires.push({ id: "series", from: { partId: "led", pinId: "1" }, to: { partId: "led2", pinId: "2" }, points: [{ x: 474.6, y: 660 }, { x: 1025.4, y: 660 }] });
  scene.parts[0].value = "3 V";
  const low = testCircuit(scene, closed); expect(low.ok).toBe(true); expect([...low.leds.values()].every((led) => !led.on)).toBe(true);
  scene.parts[0].value = "9 V";
  const powered = testCircuit(scene, closed); expect(powered.ok).toBe(true);
  expect(powered.leds.get("led")!.currentMa).toBeCloseTo(8, 4);
  expect(powered.leds.get("led2")!.currentMa).toBeCloseTo(8, 4);
});
it("does not build equations for hundreds of unused header pins", () => {
  const source = circuit(); source.parts = [source.parts[0]]; source.wires = [];
  for (let index = 0; index < 31; index++) source.parts.push({ ...source.parts[0], id: `header${index}`, kind: "pin-header", reference: `J${index + 1}`, footprint: "Male Header 1x40", value: "Header", x: index * 1000 });
  const result = testCircuit(source); expect(result.ok).toBe(true); expect(result.supplyCurrentMa).toBe(0);
});
it.each(["invalid", "0 Ω", "-1 kΩ", "1e99 Ω"])("refuses invalid resistance %s", (value) => {
  const scene = circuit(); scene.parts[1].value = value;
  const result = testCircuit(scene, closed);
  expect(result.ok).toBe(false); expect(result.leds.size).toBe(0); expect(result.error).toContain("R1");
});
it.each([["330 Ω", 330], ["4k7", 4700], ["1 MΩ", 1e6], ["R47", .47], ["10mΩ", .01], ["1e3", 1000]])("reads %s without silently inventing a value", (value, expected) => {
  expect(simulationResistance(String(value))).toBeCloseTo(Number(expected), 5);
});
it("blocks unsupported components, unknown colours, missing sources and oversized scenes", () => {
  const scene = circuit(); scene.parts.push({ ...scene.parts[1], id: "cap", reference: "C1", kind: "capacitor", footprint: PART_BY_KIND.get("capacitor")!.defaultFootprint, value: "100 µF" });
  expect(testCircuit(scene).error).toContain("C1 (capacitor)");
  for (const value of ["Unspecified", "__proto__", "constructor"]) {
    const colour = circuit(); colour.parts[3].value = value; expect(testCircuit(colour).error).toContain("colour");
  }
  const source = circuit(); source.parts = source.parts.filter((part) => part.kind !== "battery"); expect(testCircuit(source).error).toContain("exactly one");
  const large = circuit(); large.parts = Array.from({ length: 33 }, () => large.parts[0]); expect(testCircuit(large).error).toContain("32 components");
});
it("refuses dangling pins and invalid source voltages", () => {
  const scene = circuit(); scene.wires[0].from.pinId = "missing"; expect(testCircuit(scene).ok).toBe(false);
  const source = circuit(); source.parts[0].value = "garbage"; expect(testCircuit(source).error).toContain("voltage");
});
