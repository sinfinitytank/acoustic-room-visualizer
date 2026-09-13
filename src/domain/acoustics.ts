import { Euler, Vector3 } from 'three'
import type { Band, Design, ReflectionPath, Room, RoomObject, Surface, Vec3, Wall } from './model'
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const distance = (a: Vec3, b: Vec3) => Math.hypot(...sub(a, b))
export const mirror = (p: Vec3, s: Surface) => sub(p, scale(s.normal, 2 * dot(sub(p, s.center), s.normal)))
export function intersect(a: Vec3, b: Vec3, s: Surface): Vec3 | null { const d = sub(b, a), denominator = dot(d, s.normal); if (Math.abs(denominator) < 1e-8) return null; const t = dot(sub(s.center, a), s.normal) / denominator; if (t < 1e-6 || t > 1 - 1e-6) return null; const p = add(a, scale(d, t)), local = sub(p, s.center); return Math.abs(dot(local, s.u)) <= s.halfU + 1e-5 && Math.abs(dot(local, s.v)) <= s.halfV + 1e-5 ? p : null }
export function roomSurfaces(r: Room): Surface[] { return [
  { id: 'front', name: 'Front wall', center: [r.width / 2, r.height / 2, 0], normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], halfU: r.width / 2, halfV: r.height / 2 },
  { id: 'rear', name: 'Rear wall', center: [r.width / 2, r.height / 2, r.length], normal: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0], halfU: r.width / 2, halfV: r.height / 2 },
  { id: 'left', name: 'Left wall', center: [0, r.height / 2, r.length / 2], normal: [1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], halfU: r.length / 2, halfV: r.height / 2 },
  { id: 'right', name: 'Right wall', center: [r.width, r.height / 2, r.length / 2], normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], halfU: r.length / 2, halfV: r.height / 2 },
  { id: 'floor', name: 'Floor', center: [r.width / 2, 0, r.length / 2], normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1], halfU: r.width / 2, halfV: r.length / 2 },
  { id: 'ceiling', name: 'Ceiling', center: [r.width / 2, r.height, r.length / 2], normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], halfU: r.width / 2, halfV: r.length / 2 },
] }
export function treatmentSurface(o: RoomObject): Surface { const e = new Euler(...o.rotation); const rotate = (v: Vec3) => new Vector3(...v).applyEuler(e).toArray() as Vec3; const normal = rotate([0, 0, 1]); return { id: o.id, objectId: o.id, name: o.name, center: add(o.position, scale(normal, o.size[2] / 2)), normal, u: rotate([1, 0, 0]), v: rotate([0, 1, 0]), halfU: o.size[0] / 2, halfV: o.size[1] / 2, absorption: o.absorption } }
export const inside = (p: Vec3, r: Room) => p.every((v, i) => v >= -1e-5 && v <= [r.width, r.height, r.length][i] + 1e-5)
export function solvePath(source: Vec3, listener: Vec3, surfaces: Surface[], room: Room): Vec3[] | null {
  if (!inside(source, room) || !inside(listener, room)) return null
  const images: Vec3[] = [source]
  for (const s of surfaces) images.push(mirror(images.at(-1)!, s))
  let cursor = listener
  const hits: Vec3[] = []
  for (let i = surfaces.length - 1; i >= 0; i--) { const hit = intersect(cursor, images[i + 1], surfaces[i]); if (!hit || !inside(hit, room)) return null; hits.unshift(hit); cursor = hit }
  const points = [source, ...hits, listener]
  for (let i = 0; i < surfaces.length; i++) { const s = surfaces[i]; if (dot(sub(points[i], s.center), s.normal) * dot(sub(points[i + 2], s.center), s.normal) <= 1e-8) return null }
  return points
}
export type RaySettings = { enabled: boolean; first: boolean; second: boolean; listener: string; band: Band; surfaces: Record<Wall, boolean>; maxSecond: number; quality: 'low' | 'high' }
export function computePaths(d: Design, settings: RaySettings, layers: { panel: boolean; bass: boolean }): ReflectionPath[] {
  if (!settings.enabled) return []
  const listener = resolveListener(d, settings.listener)
  if (!listener) return []
  const treatments = d.objects.filter(o => (o.kind === 'panel' || o.kind === 'bass') && o.visible && layers[o.kind])
  const blockers = treatments.map(treatmentSurface)
  const surfaces = [...roomSurfaces(d.room).filter(s => settings.surfaces[s.id as Wall]), ...treatments.filter(o => o.reflect).map(treatmentSurface)]
  const output: ReflectionPath[] = []
  for (const [speakerIndex, speaker] of d.objects.filter(o => o.kind === 'speaker' && o.reflect).entries()) {
    const source = add(speaker.position, new Vector3(0, speaker.tweeter, speaker.size[2] / 2 + 0.003).applyEuler(new Euler(...speaker.rotation)).toArray() as Vec3)
    let secondCount = 0
    const tryPath = (seq: Surface[]) => {
      if (seq.length === 2 && secondCount >= settings.maxSecond) return
      const points = solvePath(source, listener.position, seq, d.room)
      if (!points) return
      // Treatments are finite reflecting planes. Other panel crossings occlude a
      // candidate path. Second-order uses the same image-source construction,
      // multiplying independent energy retention (1-alpha) at each contact.
      for (let i = 0; i < points.length - 1; i++) for (const blocker of blockers) { if (intersect(points[i], points[i + 1], blocker)) return }
      const energy = seq.reduce((e, s) => e * (1 - (s.absorption?.[settings.band] || 0)), 1)
      output.push({ id: `${speaker.id}:${seq.map(s => s.id).join(':')}`, source: speaker.name, listener: listener.name, order: seq.length as 1 | 2, points, surfaces: seq.map(s => s.name), length: points.slice(1).reduce((n, p, i) => n + distance(p, points[i]), 0), energy, color: speakerIndex % 2 ? '#b498f1' : '#69d4bf' })
      if (seq.length === 2) secondCount++
    }
    if (settings.first) for (const a of surfaces) tryPath([a])
    if (settings.second) { const limit = settings.quality === 'low' ? 18 : 80; const candidates = surfaces.slice(0, limit); for (const a of candidates) for (const b of candidates) if (a.id !== b.id) tryPath([a, b]) }
  }
  return output
}

// A destination from another project/import must never silently suppress rays.
export function resolveListener(d: Design, requested: string) {
  return d.objects.find(o => o.kind === 'listener' && o.id === requested) || d.objects.find(o => o.kind === 'listener')
}
export function rayStatus(d: Design, s: RaySettings, count: number): string {
  if (!s.enabled) return 'Reflections are switched off.'
  if (!d.objects.some(o => o.kind === 'speaker')) return 'Place a speaker from the library to start tracing rays.'
  if (!d.objects.some(o => o.kind === 'speaker' && o.reflect)) return 'Enable reflections for at least one speaker below.'
  const listener = resolveListener(d, s.listener)
  if (!listener) return 'Place a sofa from the library. Its two listeners are added automatically.'
  if (!inside(listener.position, d.room)) return 'The listener is outside the room. Move its sofa inside the room.'
  if (!s.first && !s.second) return 'Enable first-order or second-order reflections.'
  if (count === 0) return 'No valid paths. Check surface toggles and keep speakers and their tweeters inside the room.'
  return `${count} valid reflection paths to ${listener.name}.`
}
