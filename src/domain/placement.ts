import { Euler, Vector3 } from 'three'
import type { Room, RoomObject, Vec3, Wall } from './model'
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
