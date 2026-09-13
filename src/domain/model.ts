// All geometry is stored in meters. x = width left-to-right, y = height,
// z = length front-to-back. Room origin is the front-left floor corner.
export type Vec3 = [number, number, number]
export const bands = ['125', '250', '500', '1000', '2000', '4000'] as const
export type Band = typeof bands[number]
export type Coefficients = Record<Band, number>
export type AbsorptionPoint = { frequency: number; coefficient: number }
export type Wall = 'front' | 'rear' | 'left' | 'right' | 'floor' | 'ceiling'
export const walls: Wall[] = ['front', 'rear', 'left', 'right', 'floor', 'ceiling']
export type Room = { width: number; length: number; height: number }
export type Stand = { height: number; width?: number; depth?: number; postWidth?: number }
export type Kind = 'speaker' | 'stand' | 'sofa' | 'listener' | 'panel' | 'bass'
export type RoomObject = { thicknessMode?: string; id: string; name: string; kind: Kind; position: Vec3; rotation: Vec3; size: Vec3; visible: boolean; reflect: boolean; color: string; stand: Stand; tweeter: number; mount: Wall | 'free'; corner: 'front-left' | 'front-right' | 'rear-left' | 'rear-right'; offset: number; bottom: number; ceilingOffset: number; absorption: Coefficients; curve?: AbsorptionPoint[]; templateId?: string; standTemplateId?: string; parentSofaId?: string; seat?: 0 | 1; placed?: boolean }
export type Speaker = RoomObject & { kind: 'speaker' }
export type Sofa = RoomObject & { kind: 'sofa' }
export type Listener = RoomObject & { kind: 'listener' }
export type Treatment = RoomObject & { kind: 'panel' | 'bass' }
export type Anchor = { point: Vec3; objectId?: string }
export type Measurement = { id: string; a: Anchor; b: Anchor }
export type Design = { version: 1; name: string; room: Room; objects: RoomObject[]; measurements: Measurement[] }
export type Surface = { id: string; name: string; center: Vec3; normal: Vec3; u: Vec3; v: Vec3; halfU: number; halfV: number; absorption?: Coefficients; objectId?: string }
export type ReflectionPath = { id: string; source: string; listener: string; order: 1 | 2; points: Vec3[]; surfaces: string[]; length: number; energy: number; color: string }
export const ft = (value: number) => value * 0.3048
export const toFeet = (value: number) => value / 0.3048
export const inches = (value: number) => value * 0.0254
export const distanceLabel = (value: number, unit: 'ft' | 'cm' = 'ft') => { if (unit === 'cm') return `${(value * 100).toFixed(1)} cm`; const total = Math.round(value / 0.0254); return `${Math.floor(total / 12)}′ ${total % 12}″` }
export const unityAbsorption = (): Coefficients => ({ '125': 1, '250': 1, '500': 1, '1000': 1, '2000': 1, '4000': 1 })
const chartCurves: Record<2 | 4 | 6, AbsorptionPoint[]> = {
  2: [
    { frequency: 32, coefficient: 0.03 }, { frequency: 63, coefficient: 0.06 },
    { frequency: 125, coefficient: 0.18 }, { frequency: 250, coefficient: 0.44 },
    { frequency: 500, coefficient: 0.72 }, { frequency: 1000, coefficient: 1 },
    { frequency: 2000, coefficient: 0.99 }, { frequency: 4000, coefficient: 1 },
    { frequency: 20000, coefficient: 1 },
  ],
  4: [
    { frequency: 32, coefficient: 0.1 }, { frequency: 63, coefficient: 0.27 },
    { frequency: 125, coefficient: 0.52 }, { frequency: 250, coefficient: 0.76 },
    { frequency: 500, coefficient: 0.88 }, { frequency: 1000, coefficient: 1 },
    { frequency: 2000, coefficient: 1 }, { frequency: 4000, coefficient: 1 },
    { frequency: 20000, coefficient: 1 },
  ],
  6: [
    { frequency: 32, coefficient: 0.24 }, { frequency: 63, coefficient: 0.54 },
    { frequency: 125, coefficient: 0.77 }, { frequency: 250, coefficient: 0.85 },
    { frequency: 500, coefficient: 0.89 }, { frequency: 1000, coefficient: 1 },
    { frequency: 2000, coefficient: 1 }, { frequency: 4000, coefficient: 1 },
    { frequency: 20000, coefficient: 1 },
  ],
}
export const curveForThickness = (thickness: number): AbsorptionPoint[] => {
  const inches = thickness / 0.0254
  const preset = inches < 3 ? 2 : inches < 5 ? 4 : 6
  return chartCurves[preset].map(point => ({ ...point }))
}
export const absorptionForCurve = (curve: AbsorptionPoint[]): Coefficients => {
  const value = (frequency: number) => {
    const points = [...curve].sort((a, b) => a.frequency - b.frequency)
    if (!points.length) return 1
    if (frequency <= points[0].frequency) return points[0].coefficient
    if (frequency >= points.at(-1)!.frequency) return points.at(-1)!.coefficient
    for (let i = 1; i < points.length; i++) if (frequency <= points[i].frequency) {
      const a = points[i - 1], b = points[i]
      const t = (Math.log(frequency) - Math.log(a.frequency)) / (Math.log(b.frequency) - Math.log(a.frequency))
      return a.coefficient + (b.coefficient - a.coefficient) * t
    }
    return 1
  }
  return Object.fromEntries(bands.map(band => [band, Math.min(1, Math.max(0, value(+band)))])) as Coefficients
}
export const defaultCurve = (): AbsorptionPoint[] => curveForThickness(0.1016)
export const presets: Record<string, Coefficients> = { Broadband: { '125': 0.25, '250': 0.65, '500': 0.85, '1000': 0.95, '2000': 0.95, '4000': 0.9 }, 'Thick mineral wool': { '125': 0.5, '250': 0.85, '500': 0.95, '1000': 0.95, '2000': 0.95, '4000': 0.95 }, 'Light fabric': { '125': 0.05, '250': 0.1, '500': 0.2, '1000': 0.35, '2000': 0.45, '4000': 0.5 } }
export function makeObject(kind: Kind, id: string = crypto.randomUUID()): RoomObject { const thickness = kind === 'bass' ? 0.1524 : 0.1016; const curve = curveForThickness(thickness); return { id, kind, name: kind === 'bass' ? 'Corner bass trap' : kind === 'panel' ? 'Absorption panel' : kind === 'listener' ? 'Listener' : kind === 'speaker' ? 'Speaker' : kind === 'stand' ? 'Speaker stand' : 'Sofa', position: [2, 1.3, 2], rotation: [0, 0, 0], size: kind === 'stand' ? [0.34, 0.65, 0.38] : kind === 'speaker' ? [0.24, 0.4, 0.31] : kind === 'sofa' ? [2, 0.82, 0.85] : kind === 'listener' ? [0.2, 0.2, 0.2] : [0.61, 1.22, thickness], visible: true, reflect: true, color: kind === 'speaker' ? '#bc9871' : kind === 'sofa' ? '#68766e' : kind === 'listener' ? '#e5b66c' : kind === 'stand' ? '#626c73' : kind === 'bass' ? '#a79478' : '#758b80', stand: { height: 0.65, width: 0.34, depth: 0.38, postWidth: 0.065 }, tweeter: 0.3, mount: 'free', corner: 'front-left', offset: 1, bottom: 0.7, ceilingOffset: 1, absorption: absorptionForCurve(curve), curve, placed: false } }
export function mountObject(o: RoomObject, r: Room): RoomObject {
  if (o.kind !== 'panel' && o.kind !== 'bass') return o
  const [w, h, t] = o.size
  if (o.kind === 'bass' && o.mount !== 'free') { const right = o.corner.endsWith('right'), rear = o.corner.startsWith('rear'); const d = w / (2 * Math.sqrt(2)) + t / 2; return { ...o, position: [right ? r.width - d : d, o.bottom + h / 2, rear ? r.length - d : d], rotation: [0, right !== rear ? -Math.PI / 4 : Math.PI / 4, 0] } }
  const y = o.bottom + h / 2, l = o.offset + w / 2
  switch (o.mount) {
    case 'front': return { ...o, position: [l, y, t / 2 + 0.008], rotation: [0, 0, 0] }
    case 'rear': return { ...o, position: [l, y, r.length - t / 2 - 0.008], rotation: [0, Math.PI, 0] }
    case 'left': return { ...o, position: [t / 2 + 0.008, y, l], rotation: [0, Math.PI / 2, 0] }
    case 'right': return { ...o, position: [r.width - t / 2 - 0.008, y, l], rotation: [0, -Math.PI / 2, 0] }
    case 'ceiling': return { ...o, position: [l, r.height - t / 2 - 0.008, o.ceilingOffset + h / 2], rotation: [Math.PI / 2, 0, 0] }
    case 'floor': return { ...o, position: [l, t / 2 + 0.008, o.ceilingOffset + h / 2], rotation: [-Math.PI / 2, 0, 0] }
    default: return o
  }
}
export function demo(): Design {
  const room = { width: ft(16), length: ft(20), height: ft(9) }
  const left = { ...makeObject('speaker', 'speaker-left'), name: 'Left speaker', position: [1.1, 0.65, 1.05] as Vec3 }
  const right = { ...makeObject('speaker', 'speaker-right'), name: 'Right speaker', position: [room.width - 1.1, 0.65, 1.05] as Vec3 }
  const sofa = { ...makeObject('sofa', 'sofa'), position: [room.width / 2, 0, 4.15] as Vec3 }
  const a = { ...makeObject('listener', 'listener-a'), name: 'Listener A', position: [room.width / 2 - 0.4, 1.12, 4] as Vec3 }
  const b = { ...makeObject('listener', 'listener-b'), name: 'Listener B', position: [room.width / 2 + 0.4, 1.12, 4] as Vec3, color: '#c89de8' }
  const treatments = [ ['front', 0.7, 0.8], ['front', 3.3, 0.8], ['left', 1.9, 0.8], ['right', 1.9, 0.8], ['ceiling', 1.4, 0] ].map(([mount, offset, bottom], i) => mountObject({ ...makeObject('panel', `panel-${i}`), name: `Absorber ${i + 1}`, mount: mount as Wall, offset: +offset, bottom: +bottom, ceilingOffset: 2.2 }, room))
  const traps = (['front-left', 'front-right'] as const).map((corner, i) => mountObject({ ...makeObject('bass', `bass-${i}`), name: `Bass trap ${i + 1}`, mount: 'front', corner, size: [0.85, 1.8, 0.15], bottom: 0.05, absorption: { ...presets['Thick mineral wool'] }, color: '#a79478' }, room))
  return { version: 1, name: 'The listening room', room, objects: [left, right, sofa, a, b, ...treatments, ...traps], measurements: [] }
}
export function validateDesign(value: unknown): Design {
  const fail = () => { throw new Error('Invalid design. Please import a version 1 Acoustic Room Visualizer JSON file.') }
  if (!value || typeof value !== 'object') return fail()
  const d = value as Design
  const finite = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max
  const vec = (v: unknown, min = -100, max = 100): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(n => finite(n, min, max))
  if (d.version !== 1 || typeof d.name !== 'string' || d.name.length > 100 || !d.room || ![d.room.width, d.room.length, d.room.height].every(n => finite(n, 1, 30)) || !Array.isArray(d.objects) || d.objects.length > 150 || !Array.isArray(d.measurements) || d.measurements.length > 100) return fail()
  const ids = new Set<string>()
  for (const o of d.objects) {
    if (!o || typeof o.id !== 'string' || ids.has(o.id) || typeof o.name !== 'string' || o.name.length > 100 || !['speaker', 'stand', 'sofa', 'listener', 'panel', 'bass'].includes(o.kind) || !vec(o.position) || !vec(o.rotation) || !vec(o.size, 0.001, 20) || typeof o.visible !== 'boolean' || typeof o.reflect !== 'boolean' || !/^#[0-9a-f]{6}$/i.test(o.color) || ![...walls, 'free'].includes(o.mount) || !['front-left', 'front-right', 'rear-left', 'rear-right'].includes(o.corner) || !o.stand || !finite(o.stand.height, 0, 10) || !finite(o.tweeter, 0, 10) || ![o.offset, o.bottom, o.ceilingOffset].every(n => finite(n, -30, 30)) || !o.absorption || !bands.every(band => finite(o.absorption[band], 0, 1))) return fail()
    if (['width', 'depth', 'postWidth'].some(k => o.stand[k as keyof Stand] !== undefined && !finite(o.stand[k as keyof Stand], 0.001, 10))) return fail()
    if (o.curve !== undefined && (!Array.isArray(o.curve) || o.curve.length > 64 || o.curve.some(point => !point || !finite(point.frequency, 20, 20000) || !finite(point.coefficient, 0, 1)))) return fail()
    if ([o.templateId, o.standTemplateId, o.parentSofaId].some(v => v !== undefined && typeof v !== 'string') || (o.seat !== undefined && o.seat !== 0 && o.seat !== 1)) return fail()
    ids.add(o.id)
  }
  for (const o of d.objects) if (o.parentSofaId && (o.kind !== 'listener' || !d.objects.some(s => s.id === o.parentSofaId && s.kind === 'sofa') || o.seat === undefined)) return fail()
  for (const m of d.measurements) { if (!m || typeof m.id !== 'string' || ![m.a, m.b].every(a => a && vec(a.point) && (a.objectId === undefined || ids.has(a.objectId)))) return fail() }
  return structuredClone(d)
}

export function blankDesign(): Design { return { version: 1, name: 'Untitled room', room: { width: ft(16), length: ft(20), height: ft(9) }, objects: [], measurements: [] } }
