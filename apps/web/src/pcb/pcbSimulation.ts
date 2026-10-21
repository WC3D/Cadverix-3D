import type { CircuitScene } from "./vendor/components/FunctionalCircuitEditor";
import { getPartPins } from "./vendor/lib/circuitPartsExact";
import { buildElectricalNets } from "./vendor/lib/pcbInterchange";

export type LedTestState = { on: boolean; currentMa: number; voltage: number; overcurrent: boolean };
export type CircuitTestResult = { ok: boolean; error?: string; warnings: string[]; leds: Map<string, LedTestState>; supplyCurrentMa: number };
const LED_DROP = new Map<string, number>([["red", 1.8], ["orange", 2], ["yellow", 2], ["green", 2.1], ["blue", 3.1], ["white", 3.1]]);
const MULTIPLIER: Record<string, number> = { "": 1, R: 1, r: 1, k: 1e3, K: 1e3, M: 1e6, m: 1e-3, G: 1e9, g: 1e9 };
const NUMBER = "[+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?";

export function simulationResistance(value: string) {
  const text = value.trim().replace(/\s+/g, "").replace(/(?:Ω|ohms?)$/i, "");
  const marking = text.match(/^(\d*)([RrKkMmGg])(\d+)$/);
  const numeric = text.match(new RegExp(`^(${NUMBER})([RrKkMmGg]?)$`, "i"));
  const resistance = marking ? Number(`${marking[1] || "0"}.${marking[3]}`) * MULTIPLIER[marking[2]] : numeric ? Number(numeric[1]) * MULTIPLIER[numeric[2]] : NaN;
  if (!Number.isFinite(resistance) || resistance < .01 || resistance > 1e9) throw new Error("resistance must be 0.01 Ω–1 GΩ (for example 330 Ω, 1 kΩ, or 4k7)");
  return resistance;
}

function solve(matrix: number[][]): number[] {
  const size = matrix.length;
  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    if (Math.abs(matrix[pivot][column]) < 1e-16) throw new Error("The DC network is singular; check its connections");
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    for (let row = column + 1; row < size; row++) {
      const factor = matrix[row][column] / matrix[column][column];
      for (let index = column + 1; index <= size; index++) matrix[row][index] -= factor * matrix[column][index];
    }
  }
  const result = new Array<number>(size);
  for (let row = size - 1; row >= 0; row--) {
    let value = matrix[row][size];
    for (let column = row + 1; column < size; column++) value -= matrix[row][column] * result[column];
    result[row] = value / matrix[row][row];
    if (!Number.isFinite(result[row])) throw new Error("The DC calculation did not produce finite results");
  }
  return result;
}

// shortcut: bounded, steady-state DC with nominal LED drops; use a SPICE engine for analog/transient devices.
export function testCircuit(scene: CircuitScene, closedSwitches: ReadonlySet<string> = new Set()): CircuitTestResult {
  const failed = (error: string): CircuitTestResult => ({ ok: false, error, warnings: [], leds: new Map(), supplyCurrentMa: 0 });
  if (scene.parts.length > 32 || scene.wires.length > 128 || scene.junctions.length > 128 || scene.wires.reduce((sum, wire) => sum + (wire.points?.length ?? 0), 0) > 1024) return failed("DC tests are limited to 32 components, 128 wires/junctions and 1,024 route points");
  const unsupported = scene.parts.filter((part) => !["battery", "resistor", "led", "pushbutton", "pin-header"].includes(part.kind));
  if (unsupported.length) return failed(`Not simulated: ${unsupported.map((part) => `${part.reference} (${part.kind})`).join(", ")}. Stop testing to edit this board.`);
  const supplies = scene.parts.filter((part) => part.kind === "battery");
  if (supplies.length !== 1) return failed("Add exactly one battery/DC source for this test mode");
  try {
    const supply = supplies[0], match = supply.value.replace(/\s+/g, "").match(new RegExp(`^(${NUMBER})V?$`, "i"));
    const voltage = match ? Number(match[1]) : NaN;
    if (!(voltage > 0 && voltage <= 60)) throw new Error(`${supply.reference}: enter a DC voltage above 0 and at most 60 V (for example 5 V)`);
    const parent = new Map<string, string>();
    const pins = new Map(scene.parts.map((part) => [part.id, getPartPins(part.kind, part.footprint)]));
    for (const part of scene.parts) for (const pin of pins.get(part.id)!) { const key = `${part.id}:${pin.electricalPin}`; parent.set(key, key); }
    const find = (key: string): string => { const next = parent.get(key); if (!next) throw new Error("A wire references a missing component or pin"); if (next === key) return key; const root = find(next); parent.set(key, root); return root; };
    const join = (a: string, b: string) => { const first = find(a), second = find(b); if (first !== second) parent.set(first, second); };
    for (const wire of scene.wires) for (const endpoint of [wire.from, wire.to]) {
      if (!pins.get(endpoint.partId)?.some((pin) => pin.id === endpoint.pinId || pin.electricalPin === endpoint.pinId)) throw new Error("A wire references a missing component or pin");
    }
    const { netByPin } = buildElectricalNets(scene), netOwners = new Map<number, string>();
    for (const [pin, net] of netByPin) { const owner = netOwners.get(net); if (owner) join(pin, owner); else netOwners.set(net, pin); }
    for (const part of scene.parts) if (part.kind === "pushbutton" && closedSwitches.has(part.id)) join(`${part.id}:1`, `${part.id}:2`);
    const positive = find(`${supply.id}:1`), ground = find(`${supply.id}:2`);
    if (positive === ground) return failed("Supply short circuit: its positive and negative pins are connected directly (possibly through a closed switch)");
    const known = new Map([[positive, voltage], [ground, 0]]);
    const branches = scene.parts.filter((part) => part.kind === "resistor" || part.kind === "led").map((part) => {
      const led = part.kind === "led", drop = led ? LED_DROP.get(part.value.trim().toLowerCase()) : 0;
      if (drop === undefined) throw new Error(`${part.reference}: choose a supported LED colour before testing`);
      let resistance = 10;
      if (!led) { try { resistance = simulationResistance(part.value); } catch (error) { throw new Error(`${part.reference}: ${(error as Error).message}`); } }
      return { part, led, drop, resistance, a: find(`${part.id}:${led ? "2" : "1"}`), b: find(`${part.id}:${led ? "1" : "2"}`) };
    });
    // Unused connector pins need no equations; two terminals per load bound matrix size.
    const unknown = [...new Set(branches.flatMap((branch) => [branch.a, branch.b]))].filter((key) => !known.has(key));
    const indices = new Map(unknown.map((key, index) => [key, index]));
    let active = new Set(branches.filter((branch) => branch.led).map((branch) => branch.part.id));
    const seen = new Set<string>();
    for (let iteration = 0; iteration < 64; iteration++) {
      const signature = [...active].sort().join("\u0000");
      if (seen.has(signature)) throw new Error("The LED model did not converge for this circuit; results are not available");
      seen.add(signature);
      const matrix = unknown.map((_, row) => Array.from({ length: unknown.length + 1 }, (_, column) => row === column ? 1e-12 : 0));
      for (const branch of branches) {
        if (branch.led && !active.has(branch.part.id)) continue;
        const conductance = 1 / branch.resistance;
        for (const [node, other, sign] of [[branch.a, branch.b, 1], [branch.b, branch.a, -1]] as const) {
          const row = indices.get(node); if (row === undefined) continue;
          matrix[row][row] += conductance;
          const column = indices.get(other);
          if (column === undefined) matrix[row][unknown.length] += conductance * known.get(other)!;
          else matrix[row][column] -= conductance;
          matrix[row][unknown.length] += sign * conductance * branch.drop;
        }
      }
      const values = solve(matrix), volts = (node: string) => known.get(node) ?? values[indices.get(node)!];
      const next = new Set(active);
      for (const branch of branches) if (branch.led) {
        const excess = volts(branch.a) - volts(branch.b) - branch.drop;
        if (active.has(branch.part.id) && excess < -1e-7) next.delete(branch.part.id);
        else if (!active.has(branch.part.id) && excess > 1e-7) next.add(branch.part.id);
      }
      if (next.size !== active.size || [...next].some((id) => !active.has(id))) { active = next; continue; }
      const result: CircuitTestResult = { ok: true, warnings: [], leds: new Map(), supplyCurrentMa: 0 };
      for (const branch of branches) {
        const delta = volts(branch.a) - volts(branch.b);
        const amps = branch.led && !active.has(branch.part.id) ? 0 : (delta - branch.drop) / branch.resistance;
        if (branch.a === positive) result.supplyCurrentMa += amps * 1000;
        if (branch.b === positive) result.supplyCurrentMa -= amps * 1000;
        if (branch.led) {
          const currentMa = Math.max(0, amps * 1000), overcurrent = currentMa > 20;
          result.leds.set(branch.part.id, { on: currentMa >= .1, currentMa, voltage: delta, overcurrent });
          if (overcurrent) result.warnings.push(`${branch.part.reference}: LED current is ${currentMa.toFixed(1)} mA, above the generic 20 mA limit. Add/increase the series resistor.`);
          if (delta < -.1) result.warnings.push(`${branch.part.reference}: LED is reverse biased; check anode/cathode polarity.`);
        } else if (amps * amps * branch.resistance > .25) result.warnings.push(`${branch.part.reference}: resistor dissipation exceeds 0.25 W; check its actual power rating.`);
      }
      result.supplyCurrentMa = Math.max(0, result.supplyCurrentMa);
      if (result.supplyCurrentMa > 1000) result.warnings.push("Supply current exceeds 1 A; check for a short or an undersized resistor.");
      return result;
    }
    return failed("The DC calculation reached its iteration limit; results are not available");
  } catch (error) { return failed(error instanceof Error ? error.message : "DC test failed; results are not available"); }
}
