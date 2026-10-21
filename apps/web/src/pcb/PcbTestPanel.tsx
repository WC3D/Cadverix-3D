"use client";
import type { CircuitScene } from "./vendor/components/FunctionalCircuitEditor";
import type { CircuitTestResult } from "./pcbSimulation";

export function PcbTestPanel({ scene, result, closedSwitches, onToggle, onStop }: { scene: CircuitScene; result: CircuitTestResult; closedSwitches: ReadonlySet<string>; onToggle: (id: string) => void; onStop: () => void }) {
  return <aside className="pcb-test-panel" aria-label="DC circuit test" onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
    <header><strong>DC circuit test</strong><button type="button" onClick={onStop}>Stop circuit test</button></header>
    <p>Click a pushbutton on the board or below to toggle its contacts. Clicks latch test contacts until clicked again; momentary timing is not simulated. A complete loop and correct LED polarity are required. Stop testing to edit.</p>
    <p>Approximate steady-state DC only: one battery/source, resistors, pushbuttons, LEDs and passive pin headers. LED colours use nominal forward drops and 10 Ω dynamic resistance. This is not a SPICE simulation or a hardware safety check.</p>
    {scene.parts.filter((part) => part.kind === "pushbutton").map((part) => <button className="pcb-test-switch" type="button" key={part.id} aria-pressed={closedSwitches.has(part.id)} onClick={() => onToggle(part.id)}>{part.reference}: {closedSwitches.has(part.id) ? "closed" : "open"}</button>)}
    {!result.ok ? <p role="alert">{result.error}</p> : <div role="status">
      <p>Supply current: {result.supplyCurrentMa.toFixed(2)} mA</p>
      <ul>{scene.parts.filter((part) => part.kind === "led").map((part) => {
        const led = result.leds.get(part.id)!;
        return <li key={part.id}>{part.reference}: {led.on ? "ON" : "OFF"} · {led.currentMa.toFixed(2)} mA{led.overcurrent ? " · OVERCURRENT — verify the series resistor" : ""}{part.hidden ? " · component hidden" : ""}</li>;
      })}</ul>
    </div>}
    {result.warnings.length ? <ul role="alert" className="pcb-test-warnings">{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul> : null}
    <p>Switches start open, reset when testing stops, and are not saved or added to project history. Readouts below 0.1 mA count as LED OFF. Check real component ratings before powering a physical board.</p>
  </aside>;
}
