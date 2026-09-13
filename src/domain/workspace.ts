import { Euler, Vector3 } from 'three'
import { blankDesign, makeObject, mountObject, unityAbsorption, validateDesign } from './model'
import type { Design, Kind, RoomObject, Vec3 } from './model'
export type LibraryItem = RoomObject & { kind: Exclude<Kind, 'listener'> }
export type Snapshot = { design: Design; library: LibraryItem[] }
export type Milestone = Snapshot & { id: string; label: string; createdAt: string; parentId: string | null }
export type Workspace = Snapshot & { version: 2; milestones: Milestone[]; activeMilestoneId: string | null }
export const WORKSPACE_KEY = 'acoustic-room-workspace-v2'
function mergeLegacyStand(w: Workspace): Workspace {
  const stands = new Map(w.library.filter(item => item.kind === 'stand').map(item => [item.id, item]))
  const library = w.library.filter(item => item.kind !== 'stand')
  const design = { ...w.design, objects: w.design.objects.map(object => {
    if (object.kind !== 'speaker' || !object.standTemplateId) return object
    const legacy = stands.get(object.standTemplateId)
    return legacy ? { ...object, stand: { height: legacy.size[1], width: legacy.size[0], depth: legacy.size[2], postWidth: legacy.stand.postWidth || object.stand.postWidth }, standTemplateId: undefined } : { ...object, standTemplateId: undefined }
  }) }
  return { ...w, design, library }
}
export function defaultLibrary(): LibraryItem[] {
  return (['panel', 'bass', 'speaker', 'stand', 'sofa'] as const).map(kind => {
    const base = makeObject(kind, `library-${kind}`)
    return { ...base, kind, absorption: unityAbsorption(), ...(kind === 'bass' ? { size: [0.85, 1.8, 0.15] as Vec3 } : {}), ...(kind === 'speaker' ? { standTemplateId: 'library-stand' } : {}) }
  })
}
export function syncSofaListeners(design: Design): Design {
  const firstSofa = design.objects.find(o => o.kind === 'sofa')
  const legacyListeners = design.objects.filter(o => o.kind === 'listener' && !o.parentSofaId).slice(0, 2)
  const adoptLegacy = firstSofa && !design.objects.some(o => o.parentSofaId === firstSofa.id)
  const objects = design.objects.map(o => {
    const adopted = adoptLegacy && legacyListeners.includes(o) ? { ...o, parentSofaId: firstSofa.id, seat: legacyListeners.indexOf(o) as 0 | 1 } : o
    if (adopted.kind === 'sofa') return { ...adopted, position: [adopted.position[0], 0, adopted.position[2]] as Vec3 }
    if (adopted.kind === 'speaker') return { ...adopted, position: [adopted.position[0], Math.min(design.room.height, Math.max(0, adopted.stand.height)), adopted.position[2]] as Vec3 }
    return adopted
  })
  for (const sofa of objects.filter(o => o.kind === 'sofa')) {
    for (const seat of [0, 1] as const) {
      const index = objects.findIndex(o => o.parentSofaId === sofa.id && o.seat === seat)
      const base = index >= 0 ? objects[index] : { ...makeObject('listener', `${sofa.id}-listener-${seat}`), name: `Listener ${seat ? 'B' : 'A'}`, parentSofaId: sofa.id, seat, color: seat ? '#b498f1' : '#e5b66c' }
      // Ear is 0.65 m above the cushion. Seat locations follow sofa dimensions,
      // translation and rotation and deliberately have no independent editor.
      const position = new Vector3((seat ? 1 : -1) * sofa.size[0] * 0.22, sofa.size[1] * 0.52 + 0.65, -sofa.size[2] * 0.08).applyEuler(new Euler(...sofa.rotation)).add(new Vector3(...sofa.position)).toArray() as Vec3
      const listener = { ...base, position, rotation: [...sofa.rotation] as Vec3 }
      if (index >= 0) objects[index] = listener; else objects.push(listener)
    }
  }
  const remaining = objects.filter(o => !o.parentSofaId || objects.some(p => p.id === o.parentSofaId && p.kind === 'sofa'))
  return { ...design, objects: remaining, measurements: design.measurements.filter(m => [m.a, m.b].every(a => !a.objectId || remaining.some(o => o.id === a.objectId))) }
}
export function instantiate(item: LibraryItem, d: Design, library: LibraryItem[]): RoomObject {
  const o: RoomObject = { ...structuredClone(item), id: crypto.randomUUID(), templateId: item.id, visible: true, reflect: true }
  const r = d.room
  const count = d.objects.filter(q => q.kind === item.kind).length
  o.name = `${item.name} ${count + 1}`
  o.position = [r.width / 2, Math.min(r.height / 2, 1.3), r.length / 2]
  o.rotation = [0, 0, 0]; o.mount = 'free'
  if (item.kind === 'speaker') {
    const legacyStand = item.standTemplateId ? library.find(q => q.id === item.standTemplateId && q.kind === 'stand') : undefined
    o.stand = legacyStand ? { height: legacyStand.size[1], width: legacyStand.size[0], depth: legacyStand.size[2], postWidth: legacyStand.stand.postWidth || 0.065 } : { ...item.stand, height: Math.max(0, item.stand.height), width: item.stand.width || item.size[0] * 1.4, depth: item.stand.depth || item.size[2] * 1.2, postWidth: item.stand.postWidth || 0.065 }
    o.position = [r.width * (count % 2 ? 0.75 : 0.25), o.stand.height, r.length * 0.18]
    o.name = count < 2 ? `${count ? 'Right' : 'Left'} speaker` : `${item.name} ${count + 1}`
  }
  if (item.kind === 'sofa') o.position = [r.width / 2, 0, r.length * 0.68]
  if (item.kind === 'bass') { o.mount = 'front'; o.corner = count % 2 ? 'front-right' : 'front-left'; o.bottom = 0.05; return mountObject(o, r) }
  return o
}
export function validateLibrary(value: unknown): LibraryItem[] {
  if (!Array.isArray(value) || value.length > 150) throw new Error('Invalid library: expected up to 150 reusable types.')
  const d = validateDesign({ ...blankDesign(), objects: value })
  if (d.objects.some(o => o.kind === 'listener' || o.parentSofaId)) throw new Error('Library types must be panels, traps, speakers or sofas.')
  return d.objects as LibraryItem[]
}
export function validateWorkspace(value: unknown): Workspace {
  const w = value as Workspace
  if (!w || w.version !== 2 || !Array.isArray(w.milestones)) throw new Error('Invalid workspace history. Choose an Acoustic Room Visualizer workspace file.')
  const snapshot = (s: Snapshot) => ({ design: validateDesign(s.design), library: validateLibrary(s.library) })
  const ids = new Set<string>()
  const milestones = w.milestones.map(m => {
    if (!m || typeof m.id !== 'string' || ids.has(m.id) || typeof m.label !== 'string' || m.label.length > 100 || !Number.isFinite(Date.parse(m.createdAt)) || (m.parentId !== null && !ids.has(m.parentId))) throw new Error('Invalid milestone history or branch references.')
    ids.add(m.id)
    return { ...snapshot(m), id: m.id, label: m.label, createdAt: m.createdAt, parentId: m.parentId }
  })
  if (w.activeMilestoneId !== null && !ids.has(w.activeMilestoneId)) throw new Error('Invalid active milestone.')
  return { version: 2, ...snapshot(w), milestones, activeMilestoneId: w.activeMilestoneId }
}
export function initialWorkspace(): Workspace {
  const library = defaultLibrary()
  const base: Workspace = { version: 2, design: blankDesign(), library, milestones: [], activeMilestoneId: null }
  try {
    const current = localStorage.getItem(WORKSPACE_KEY)
    if (current) return mergeLegacyStand(validateWorkspace(JSON.parse(current)))
    // Preserve previous-version progress as a recoverable milestone while the
    // revised planner starts with the blank room requested by the user.
    for (const [key, label] of [['acoustic-room-visualizer-v1', 'Previous workspace'], ['acoustic-room-manual-save', 'Previous manual save']]) {
      const raw = localStorage.getItem(key)
      if (raw) try { base.milestones.push({ id: crypto.randomUUID(), label, createdAt: new Date().toISOString(), parentId: null, design: validateDesign(JSON.parse(raw)), library: structuredClone(library) }) } catch { /* Keep the legacy key untouched if it cannot be read. */ }
    }
  } catch { /* The app remains usable without browser storage. */ }
  return base
}
