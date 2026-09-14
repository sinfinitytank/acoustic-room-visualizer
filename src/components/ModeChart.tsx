import { useMemo, useState } from 'react';
import type { PointerEvent } from 'react';
import { nearestRoomMode, schroederFrequency } from '../domain/acoustics';
import type { RoomMode } from '../domain/acoustics';
import type { Room } from '../domain/model';
import { modeKinds, modeLabel } from './modeSettings';
import type { ModeSettings } from './modeSettings';

const W = 1000, H = 210, LEFT = 24, RIGHT = 976, TOP = 32, BASE = 171;
export default function ModeChart({ room, settings, modes, selected, onSelect }: {
  room: Room; settings: ModeSettings; modes: RoomMode[]; selected?: RoomMode; onSelect: (id: string) => void;
}) {
  const [hover, setHover] = useState<RoomMode>();
  const { minimum, maximum } = settings;
  const x = (frequency: number) => LEFT + Math.log(frequency / minimum) / Math.log(maximum / minimum) * (RIGHT - LEFT);
  const schroeder = schroederFrequency(room, settings.rt60);
  const curves = useMemo(() => modeKinds.map(kind => {
    const columns = new Set<number>();
    for (const m of modes) if (m.kind === kind) columns.add(Math.round((LEFT + Math.log(m.frequency / minimum) / Math.log(maximum / minimum) * (RIGHT - LEFT)) * 2) / 2);
    const top = kind === 'Axial' ? TOP + 5 : kind === 'Tangential' ? 79 : 120;
    return { kind, path: [...columns].map(px => `M${px},${BASE}V${top}`).join('') };
  }), [modes, minimum, maximum]);
  const semitones = Array.from({ length: 128 }, (_, midi) => ({ midi, frequency: 440 * 2 ** ((midi - 69) / 12) })).filter(n => n.frequency * 2 ** (0.5 / 12) >= minimum && n.frequency / 2 ** (0.5 / 12) <= maximum);
  const ticks = [5, 8, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 160, 200, 250, 300].filter(f => f >= minimum && f <= maximum);
  const locate = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - bounds.left) / bounds.width * W;
    const frequency = minimum * (maximum / minimum) ** Math.max(0, Math.min(1, (px - LEFT) / (RIGHT - LEFT)));
    return nearestRoomMode(modes, frequency);
  };
  const move = (offset: number) => {
    const index = modes.findIndex(m => m.id === selected?.id);
    const next = modes[Math.max(0, Math.min(modes.length - 1, index + offset))];
    if (next) onSelect(next.id);
  };
  // Hover information is read from the current filtered calculation only.
  const inspected = modes.find(m => m.id === hover?.id) ?? selected;
  return <section className="mode-spectrum" aria-label="Room mode frequency spectrum">
    <header><div><h2>Room modes</h2><p>Select a line to see its pressure pattern</p></div><span>{modes.length} modes · {minimum}–{maximum} Hz</span></header>
    <div className="mode-chart-scroll">
      <svg viewBox={`0 0 ${W} ${H}`} className="mode-chart" role="slider" tabIndex={0} aria-label="Room mode spectrum" aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={selected?.frequency ?? minimum} aria-valuetext={selected ? modeLabel(selected) : 'No modes in range'}
        onPointerMove={e => setHover(locate(e))} onPointerLeave={() => setHover(undefined)}
        onPointerDown={e => { e.currentTarget.focus(); const nearest = locate(e); if (!nearest) return; const coincident = modes.filter(m => Math.abs(m.frequency - nearest.frequency) < 1e-6); const index = coincident.findIndex(m => m.id === selected?.id); onSelect(coincident[(index + 1) % coincident.length].id); }}
        onKeyDown={e => { if (['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home', 'End'].includes(e.key)) { e.preventDefault(); if (e.key === 'Home' && modes.length) onSelect(modes[0].id); else if (e.key === 'End' && modes.length) onSelect(modes[modes.length - 1].id); else move(e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 1); } }}>
        <title>Logarithmic mode frequencies with semitone bands. Arrow keys select modes; repeat a click to cycle coincident modes.</title>
        {semitones.map(({ midi, frequency }) => { const start = Math.max(LEFT, x(frequency / 2 ** (0.5 / 12))), end = Math.min(RIGHT, x(frequency * 2 ** (0.5 / 12))); return <rect key={midi} x={start} width={end - start} y={TOP} height={BASE - TOP} className={[1, 3, 6, 8, 10].includes(midi % 12) ? 'mode-black-key' : 'mode-white-key'} />; })}
        {ticks.map(f => <g key={f}><line x1={x(f)} x2={x(f)} y1={BASE} y2={BASE + 7} className="mode-axis" /><text x={x(f)} y={BASE + 25} textAnchor="middle">{f}</text></g>)}
        {curves.map(({ kind, path }) => <path key={kind} d={path} className={`mode-spikes mode-kind-${kind.toLowerCase()}`} />)}
        {schroeder >= minimum && schroeder <= maximum && <line x1={x(schroeder)} x2={x(schroeder)} y1={TOP} y2={BASE} className="mode-schroeder-line" />}
        <text x={RIGHT} y={18} textAnchor="end" className="mode-schroeder-label">Schroeder {schroeder.toFixed(1)} Hz · RT60 {settings.rt60.toFixed(2)} s{schroeder > maximum ? ' →' : schroeder < minimum ? ' ←' : ''}</text>
        {selected && <line data-testid="selected-mode-line" x1={x(selected.frequency)} x2={x(selected.frequency)} y1={TOP} y2={BASE + 7} className="mode-selected-line" />}
        <line x1={LEFT} x2={RIGHT} y1={BASE} y2={BASE} className="mode-axis" />
      </svg>
    </div>
    <footer><span aria-live="polite">{inspected ? modeLabel(inspected) : 'No modes in range'}</span><small>Line height = mode type, not loudness · Hz (log)</small></footer>
  </section>;
}
