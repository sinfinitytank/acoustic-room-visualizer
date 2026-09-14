import type { LengthUnit } from '../domain/model';
import { modeKinds, modeLabel } from './modeSettings';
import type { ModeSettings } from './modeSettings';
import { NumberField, RoomEditor, Section, Toggle } from './Controls';
import type { RoomMode } from '../domain/acoustics';
import { schroederFrequency } from '../domain/acoustics';
import type { Room } from '../domain/model';

export default function ModePanel({ room, unit, settings, onSettings, modes, selected, onSelect }: {
  room: Room; unit: LengthUnit; settings: ModeSettings; onSettings: (settings: ModeSettings) => void;
  modes: RoomMode[]; selected?: RoomMode; onSelect: (id: string) => void;
}) {
  const index = selected ? modes.findIndex(m => m.id === selected.id) : -1;
  // Bound the native selector for very large rooms; chart and arrows still
  // reach every mode, including every member of a coincident group.
  const nearby = modes.slice(Math.max(0, index - 50), Math.max(101, index + 51));
  return <>
    <RoomEditor unit={unit} />
    <Section title="Frequency spectrum">
      <div className="mode-range-fields">
        <NumberField label="From" suffix="Hz" value={settings.minimum} min={5} max={settings.maximum - 1} step={1} onChange={minimum => onSettings({ ...settings, minimum })} />
        <NumberField label="To" suffix="Hz" value={settings.maximum} min={settings.minimum + 1} max={300} step={1} onChange={maximum => onSettings({ ...settings, maximum })} />
      </div>
      <div className="mode-kind-filters" role="group" aria-label="Mode types">{modeKinds.map(kind => <button key={kind} className={`mode-kind-${kind.toLowerCase()}`} aria-pressed={settings.kinds[kind]} onClick={() => onSettings({ ...settings, kinds: { ...settings.kinds, [kind]: !settings.kinds[kind] } })}><i />{kind}</button>)}</div>
      <NumberField label="RT60" value={settings.rt60} min={0.05} max={5} step={0.01} suffix="s" onChange={rt60 => onSettings({ ...settings, rt60 })} />
      <div className="mode-schroeder"><span>Schroeder frequency</span><strong data-testid="schroeder-frequency">{schroederFrequency(room, settings.rt60).toFixed(2)} Hz</strong></div>
      <p className="hint">RT60 is an input estimate for the transition marker.</p>
    </Section>
    <Section title="Selected room mode" extra={<span className="badge">{modes.length} modes</span>}>
      {selected ? <>
        <div className="mode-readout" aria-live="polite"><strong data-testid="mode-frequency">{selected.frequency.toFixed(2)} <small>Hz</small></strong><span>{selected.kind} · ({selected.orders.join(', ')})</span></div>
        <p className="mode-order-key">Mode orders: length · width · height</p>
        <label className="text-field">Select mode<select aria-label="Select room mode" value={selected.id} onChange={e => onSelect(e.target.value)}>{nearby.map(m => <option key={m.id} value={m.id}>{modeLabel(m)}</option>)}</select></label>
        <div className="button-pair"><button disabled={index <= 0} onClick={() => onSelect(modes[index - 1].id)}>← Previous mode</button><button disabled={index >= modes.length - 1} onClick={() => onSelect(modes[index + 1].id)}>Next mode →</button></div>
        {modes.length > 101 && <p className="hint">The selector lists nearby modes. Use the chart to jump across the spectrum.</p>}
      </> : <p className="hint" role="status">No modes in this range. Widen the frequency range or enable a mode type.</p>}
      <Toggle label="Show nodal planes" checked={settings.nodes} onChange={nodes => onSettings({ ...settings, nodes })} />
      <Toggle label="Animate pressure" checked={settings.animate} onChange={animate => onSettings({ ...settings, animate })} />
    </Section>
    <Section title="Read the pressure map">
      <div className="mode-pressure-key"><span>− Pressure</span><i /><span>+ Pressure</span></div>
      <p className="hint">Red and blue are opposite phases; both are pressure maxima. Stationary gray bands mark pressure nodes. Animation is slowed for inspection.</p>
      <p className="hint">Pressure-based resonant traps target pressure maxima. Porous bass traps need depth and air motion; this map alone does not predict their absorption.</p>
      <p className="hint">Ideal rectangular room · sound speed 343 m/s. Objects remain visible, but do not change these mode frequencies or pressure patterns.</p>
    </Section>
  </>;
}
