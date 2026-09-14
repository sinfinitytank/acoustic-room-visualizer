import { Euler, Vector3 } from 'three'
import type { Room, RoomObject, Vec3, Wall } from './model'

export type PanelOrientation = 'vertical' | 'horizontal'
export type ReflectionTarget = { wall: Wall; point: Vec3; weight?: number }
export type OptimizedPanelPlacement = {
  wall: Wall
  center: Vec3
  covered: number
}
export type PanelOptimization = {
  placements: OptimizedPanelPlacement[]
  targetCount: number
  coveredTargetCount: number
}

type SurfacePoint = { u: number; v: number }
type SurfaceRect = SurfacePoint & { halfU: number; halfV: number }

const panelSize = (
  orientation: PanelOrientation,
  dimensions: [number, number] = [0.61, 1.22],
): [number, number] =>
  orientation === 'horizontal'
    ? [dimensions[1], dimensions[0]]
    : dimensions

const surfacePoint = (wall: Wall, point: Vec3): SurfacePoint => {
  if (wall === 'left' || wall === 'right') return { u: point[2], v: point[1] }
  if (wall === 'floor' || wall === 'ceiling') return { u: point[0], v: point[2] }
  return { u: point[0], v: point[1] }
}

const worldPoint = (wall: Wall, { u, v }: SurfacePoint, room: Room): Vec3 => {
  if (wall === 'left') return [0, v, u]
  if (wall === 'right') return [room.width, v, u]
  if (wall === 'floor') return [u, 0, v]
  if (wall === 'ceiling') return [u, room.height, v]
  return [u, v, wall === 'rear' ? room.length : 0]
}

const surfaceBounds = (wall: Wall, room: Room) =>
  wall === 'left' || wall === 'right'
    ? { u: room.length, v: room.height }
    : wall === 'floor' || wall === 'ceiling'
      ? { u: room.width, v: room.length }
      : { u: room.width, v: room.height }

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const clampCenter = (wall: Wall, center: SurfacePoint, room: Room, halfU: number, halfV: number): SurfacePoint => {
  const bounds = surfaceBounds(wall, room)
  return {
    u: clamp(center.u, halfU, Math.max(halfU, bounds.u - halfU)),
    v: clamp(center.v, halfV, Math.max(halfV, bounds.v - halfV)),
  }
}

const rectsOverlap = (a: SurfaceRect, b: SurfaceRect) =>
  Math.abs(a.u - b.u) < a.halfU + b.halfU - 1e-6 &&
  Math.abs(a.v - b.v) < a.halfV + b.halfV - 1e-6

/**
 * Groups nearby wall reflection points into the smallest practical set of
 * standard panels. The greedy pass only accepts non-overlapping rectangles;
 * points that cannot be covered without a collision are left uncovered.
 */
export function optimizeReflectionPanels(
  targets: ReflectionTarget[],
  room: Room,
  orientation: PanelOrientation,
  dimensions?: [number, number],
): PanelOptimization {
  const [width, height] = panelSize(orientation, dimensions)
  const halfU = width / 2
  const halfV = height / 2
  const unique = new Map<string, ReflectionTarget>()
  for (const target of targets) {
    const { u, v } = surfacePoint(target.wall, target.point)
    const key = `${target.wall}:${u.toFixed(4)}:${v.toFixed(4)}`
    const previous = unique.get(key)
    unique.set(key, { ...target, weight: (previous?.weight ?? 0) + (target.weight ?? 1) })
  }

  const placements: OptimizedPanelPlacement[] = []
  let coveredTargetCount = 0
  const epsilon = 1e-5

  for (const wall of ['front', 'rear', 'left', 'right', 'floor', 'ceiling'] as Wall[]) {
    const bounds = surfaceBounds(wall, room)
    if (width > bounds.u || height > bounds.v) continue
    const wallTargets = [...unique.values()].filter(target => target.wall === wall)
    const points = [...unique.values()]
      .filter(target => target.wall === wall)
      .map(target => surfacePoint(wall, target.point))
    const remaining = points.map(() => true)
    const blocked: SurfaceRect[] = []
    const candidates: SurfacePoint[] = []
    const candidateKeys = new Set<string>()
    const addCandidate = (candidate: SurfacePoint) => {
      const centered = clampCenter(wall, candidate, room, halfU, halfV)
      const key = `${centered.u.toFixed(5)}:${centered.v.toFixed(5)}`
      if (!candidateKeys.has(key)) {
        candidateKeys.add(key)
        candidates.push(centered)
      }
    }

    const row = points.length ? points.reduce((sum, p) => sum + p.v, 0) / points.length : 0
    points.forEach(addCandidate)
    // Common rows and a modest grid make equally effective choices repeatable.
    points.forEach(p => {
      addCandidate({ u: Math.round(p.u / 0.05) * 0.05, v: row })
      addCandidate({ u: bounds.u / 2, v: p.v })
    })
    // Independent edge events find multi-point rectangles missed by pair midpoints.
    for (const a of points) for (const b of points) {
      if (Math.abs(a.u - b.u) > width + epsilon || Math.abs(a.v - b.v) > height + epsilon) continue
      for (const signU of [-1, 1]) for (const signV of [-1, 1])
        addCandidate({ u: a.u + signU * halfU, v: b.v + signV * halfV })
    }
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (Math.abs(points[i].u - points[j].u) <= width + epsilon && Math.abs(points[i].v - points[j].v) <= height + epsilon)
          addCandidate({ u: (points[i].u + points[j].u) / 2, v: (points[i].v + points[j].v) / 2 })
      }
    }

    while (remaining.some(Boolean)) {
      // Extend existing rows/columns at a consistent 5 cm gap.
      for (const placed of blocked) for (const sign of [-1, 1]) {
        addCandidate({ u: placed.u + sign * (width + 0.05), v: placed.v })
        addCandidate({ u: placed.u, v: placed.v + sign * (height + 0.05) })
      }
      let best: { center: SurfacePoint; rect: SurfaceRect; indices: number[]; score: number } | null = null
      for (const center of candidates) {
        const rect = { ...center, halfU, halfV }
        if (blocked.some(existing => rectsOverlap({ ...rect, halfU: halfU + 0.05, halfV: halfV + 0.05 }, existing))) continue
        const indices = remaining.reduce<number[]>((found, isRemaining, index) => {
          const point = points[index]
          if (isRemaining && Math.abs(point.u - center.u) <= halfU + epsilon && Math.abs(point.v - center.v) <= halfV + epsilon)
            found.push(index)
          return found
        }, [])
        if (!indices.length) continue
        const weight = indices.reduce((sum, i) => sum + (wallTargets[i].weight ?? 1), 0)
        const centering = indices.reduce((sum, i) => sum + ((points[i].u - center.u) / halfU) ** 2 + ((points[i].v - center.v) / halfV) ** 2, 0) / indices.length
        const alignment = blocked.length
          ? Math.min(...blocked.map(p => Math.min(Math.abs(p.u - center.u) / width, Math.abs(p.v - center.v) / height)))
          : Math.abs(center.v - row) / height
        // Coverage dominates; small gains cannot justify severe staggering.
        const score = weight - 0.35 * Math.min(2, alignment) - 0.15 * centering
        if (!best || score > best.score + epsilon) best = { center, rect, indices, score }
      }

      // A lone low-priority secondary contact does not warrant another panel.
      if (!best || best.score < 0.6) break
      best.indices.forEach(index => { remaining[index] = false })
      blocked.push(best.rect)
      coveredTargetCount += best.indices.length
      placements.push({ wall, center: worldPoint(wall, best.center, room), covered: best.indices.length })
    }
  }

  return {
    placements,
    targetCount: pointsCount(unique),
    coveredTargetCount,
  }
}

const pointsCount = (targets: Map<string, ReflectionTarget>) => targets.size

// Snap a rotated object's world-space bounding box to a room plane.
export function snapToSurface(o: RoomObject, room: Room, wall: Wall): Vec3 {
  const [w, h, d] = o.size
  const min: Vec3 = [-w / 2, o.kind === 'speaker' ? -o.stand.height : o.kind === 'sofa' ? 0 : -h / 2, -d / 2]
  const max: Vec3 = [w / 2, o.kind === 'speaker' || o.kind === 'sofa' ? h : h / 2, d / 2]
  const points = []
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) points.push(new Vector3(x, y, z).applyEuler(new Euler(...o.rotation)).add(new Vector3(...o.position)))
  const axis = wall === 'left' || wall === 'right' ? 0 : wall === 'floor' || wall === 'ceiling' ? 1 : 2
  const high = wall === 'right' || wall === 'ceiling' || wall === 'rear'
  const bound = (high ? Math.max : Math.min)(...points.map(p => p.getComponent(axis)))
  const pos = [...o.position] as Vec3
  pos[axis] += (high ? [room.width, room.height, room.length][axis] : 0) - bound
  return pos
}
