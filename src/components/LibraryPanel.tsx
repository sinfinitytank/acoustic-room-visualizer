import Icon from './Icon'
import ThicknessControl from './ThicknessControl'
import AbsorptionGraph from './AbsorptionGraph'
import { useEffect, useState } from 'react'
import { absorptionForCurve, bands, curveForThickness, defaultCurve, distanceLabel, ft, makeObject, toFeet } from '../domain/model'
import type { Vec3 } from '../domain/model'
import { interpolateCurve } from '../domain/acoustics'
import type { LibraryItem } from '../domain/workspace'
import { validateLibrary } from '../domain/workspace'
import { useStudio } from '../domain/store'
import { NumberField, Section } from './Controls'
export default function LibraryPanel({ unit, onPlace, onMessage }: { unit: 'ft' | 'cm'; onPlace: (id: string) => void; onMessage: (message: string) => void }) {
  const library = useStudio(s => s.library), saveItem = useStudio(s => s.saveLibraryItem), deleteItem = useStudio(s => s.deleteLibraryItem)
  const [draft, setDraft] = useState<LibraryItem | null>(null), [creating, setCreating] = useState(false), [apply, setApply] = useState(false)
  const draftId = draft?.id
  useEffect(() => { if (draftId) document.querySelector('.library-editor')?.scrollIntoView({ block: 'start' }) }, [draftId])
  const edit = (item: LibraryItem) => { setDraft(structuredClone(item)); setCreating(false); setApply(false) }
  const start = (kind: LibraryItem['kind'] = 'panel') => { setDraft({ ...makeObject(kind), kind }); setCreating(true); setApply(false) }
  const update = (p: Partial<LibraryItem>) => setDraft(d => d ? { ...d, ...p } : null)
  const display = unit === 'ft' ? toFeet : (n: number) => n * 100
  const convert = unit === 'ft' ? ft : (n: number) => n / 100
  const dim = (label: string, i: number) => draft && <NumberField label={label} value={display(draft.size[i])} min={display(0.015)} max={display(9)} suffix={unit} onChange={n => { const size = [...draft.size] as Vec3; size[i] = convert(n); if ((draft.kind === 'panel' || draft.kind === 'bass') && i === 2) { const nextCurve = curveForThickness(size[i]); update({ size, curve: nextCurve, absorption: absorptionForCurve(nextCurve) }) } else update({ size }) }} />
  const locked = !!draft && draft.thicknessMode !== "custom" && [2,4,6].some(n=>Math.abs(draft.size[2]-n*.0254)<1e-6)
  const curve = draft?.curve?.length ? draft.curve : defaultCurve()
  const nrc = draft ? (['250', '500', '1000', '2000'] as const).reduce((sum, frequency) => sum + interpolateCurve(curve, +frequency, 1), 0) / 4 : 1
  const itemNrc = (item: LibraryItem) => item.curve?.length ? (['250', '500', '1000', '2000'] as const).reduce((sum, frequency) => sum + interpolateCurve(item.curve, +frequency, 1), 0) / 4 : (item.absorption['250'] + item.absorption['500'] + item.absorption['1000'] + item.absorption['2000']) / 4
  const commitCurve = (points: LibraryItem['curve'] = curve) => {
    const normalized = points.map(point => ({ frequency: Math.min(20000, Math.max(20, Math.round(point.frequency))), coefficient: Math.min(1, Math.max(0, point.coefficient)) })).sort((a, b) => a.frequency - b.frequency)
    const absorption = Object.fromEntries(bands.map(b => [b, interpolateCurve(normalized, +b, 1)])) as LibraryItem['absorption']
    update({ curve: normalized, absorption })
  }

  const persist = () => { if (!draft) return; try { if (creating && library.length >= 150) throw new Error('The library supports up to 150 types. Delete an unused type first.'); if (!draft.name.trim()) throw new Error('Give this library type a name.'); const item = draft.kind === 'panel' || draft.kind === 'bass' ? { ...draft, curve, absorption: absorptionForCurve(curve), name: draft.name.trim() } : { ...draft, name: draft.name.trim() }; validateLibrary([item]); saveItem(item, apply); setDraft(null); onMessage(apply ? 'Library type and its placed copies updated.' : 'Library type saved. New placements will use these settings.') } catch (e) { onMessage(e instanceof Error ? e.message : 'Unable to save this library type.') } }
  return <>
    <Section title="Object & treatment library"><p className="hint">Set dimensions once, then place as many copies as you need. Edit or delete any type at any time.</p><button className="wide-button" onClick={() => start()}>＋ New library type</button></Section>
    {draft && <Section title={creating ? 'Add a library type' : 'Edit library type'} extra={<button aria-label="Close library editor" onClick={() => setDraft(null)}>×</button>}><div className="library-editor">
      {creating && <label className="text-field">Type<select aria-label="Library type" value={draft.kind} disabled={!creating} onChange={e => { const kind = e.target.value as LibraryItem['kind']; setDraft({ ...makeObject(kind, draft.id), kind }) }}><option value="panel">Absorption panel</option><option value="bass">Corner bass trap</option><option value="speaker">Speaker with stand</option><option value="sofa">Sofa</option></select></label>}
      <label className="text-field">Name<input aria-label="Library type name" value={draft.name} maxLength={100} onChange={e => update({ name: e.target.value })} /></label>
      {dim('Template width', 0)}{dim(draft.kind === 'panel' || draft.kind === 'bass' ? 'Template length' : 'Template height', 1)}
      {draft.kind === 'panel' || draft.kind === 'bass' ? <><ThicknessControl object={draft} onChange={update} /><div className="curve-editor"><div className="curve-title"><strong>Per-frequency absorption</strong><span>NRC {nrc.toFixed(2)}</span></div><fieldset className="curve-fields" disabled={locked}>{curve.map((point, i) => <div className="curve-row" key={i}><NumberField label="Frequency" value={point.frequency} min={20} max={20000} step={1} suffix="Hz" onChange={n => update({ curve: curve.map((q, j) => j === i ? { ...q, frequency: n } : q) })} /><NumberField label="NRC" value={point.coefficient} min={0} max={1} step={0.01} onChange={n => update({ curve: curve.map((q, j) => j === i ? { ...q, coefficient: n } : q) })} /><button aria-label="Delete frequency point" onClick={() => update({ curve: curve.filter((_, j) => j !== i) })}>×</button></div>)}<div className="button-pair"><button onClick={() => update({ curve: [...curve, { frequency: 1000, coefficient: 1 }] })}>＋ Add frequency point</button><button className="primary" onClick={() => commitCurve()}>Set frequency and NRC</button></div></fieldset>{locked && <p className="hint">Preset data is locked. Choose Custom thickness to edit frequency and absorption values.</p>}<p className="hint">Use any frequencies from 20 Hz to 20 kHz. Log-frequency interpolation generates a continuous absorption curve.</p><AbsorptionGraph points={curve} /></div></> : dim('Template depth', 2)}
      {draft.kind === 'speaker' && <><NumberField label="Template tweeter height" value={display(draft.tweeter)} min={0} max={display(draft.size[1])} suffix={unit} onChange={n => update({ tweeter: convert(n) })} /><NumberField label="Stand height" value={display(draft.stand.height)} min={0} max={display(9)} suffix={unit} onChange={n => update({ stand: { ...draft.stand, height: convert(n) } })} /><p className="hint">The speaker and stand are one reusable library type. The cabinet always rests on this stand height above the floor.</p></>}
      {draft.kind === 'sofa' && <p className="model-notice">Two listeners are included automatically. They stay seated as you move, rotate or resize the sofa.</p>}
      <label className="color-row">Color<input type="color" aria-label="Library color" value={draft.color} onChange={e => update({ color: e.target.value })} /></label>
      {!creating && <label className="toggle-row"><span>Also update placed copies</span><input type="checkbox" checked={apply} onChange={e => setApply(e.target.checked)} /></label>}
      <div className="button-pair"><button className="primary" onClick={persist}>Save type</button><button onClick={() => setDraft(null)}>Cancel</button></div>
    </div></Section>}
    {([['panel', 'Treatment Library'], ['bass', 'Corner bass traps'], ['speaker', 'Speakers'], ['sofa', 'Sofas']] as const).map(([kind, title]) => <Section key={kind} title={title} extra={<button aria-label={`Add ${kind} type`} onClick={() => start(kind)}>＋</button>}>
      {library.filter(q => q.kind === kind).length === 0 && <p className="hint">No types yet. Use ＋ to create one.</p>}
      <div className="template-list">{library.filter(q => q.kind === kind).map(item => <article className="template-card" key={item.id} draggable onDragStart={e => e.dataTransfer.setData('application/acoustic-template', item.id)}>
        <div className="template-heading"><span className="library-type-icon" style={{ color: item.color }}><Icon name={kind} /></span><div><h3>{item.name}</h3><p>{item.size.map(n => distanceLabel(n, unit)).join(' × ')}</p>{(kind === 'panel' || kind === 'bass') && <p>NRC {itemNrc(item).toFixed(2)}</p>}{kind === 'sofa' && <p>Includes Listener A + B</p>}</div></div>
        <div className="template-actions"><button className="primary" aria-label={`Place ${item.name}`} onClick={() => onPlace(item.id)}><Icon name="plus" />Place</button><button aria-label={`Edit ${item.name}`} onClick={() => edit(item)}><Icon name="edit" />Edit</button><button aria-label={`Delete type ${item.name}`} onClick={() => { deleteItem(item.id); if (draft?.id === item.id) setDraft(null); onMessage('Type deleted from the library. Placed objects are kept; Undo restores the type.') }}><Icon name="delete" />Delete</button></div>
      </article>)}</div>
    </Section>)}
  </>
}
