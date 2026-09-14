import { expect, it } from 'vitest'
import { optimizeReflectionPanels, snapToSurface } from './placement'
import { makeObject } from './model'
it('snaps furniture to floor and far wall using its bounds', () => { const sofa = makeObject('sofa', 's'); const r = { width: 5, height: 3, length: 6 }; expect(snapToSurface(sofa, r, 'floor')[1]).toBe(0); expect(snapToSurface(sofa, r, 'rear')[2]).toBeCloseTo(6 - sofa.size[2] / 2) })
it('snaps a rotated panel by its rotated bounds', () => { const panel = makeObject('panel', 'p'); panel.rotation = [0, Math.PI / 2, 0]; expect(snapToSurface(panel, { width: 5, height: 3, length: 6 }, 'left')[0]).toBeCloseTo(panel.size[2] / 2) })
it('clusters nearby points into one vertical panel without overlap', () => {
  const result = optimizeReflectionPanels([
    { wall: 'front', point: [1.1, 1.1, 0] },
    { wall: 'front', point: [1.5, 1.7, 0] },
    { wall: 'front', point: [4, 1.1, 0] },
  ], { width: 6, height: 3, length: 8 }, 'vertical')
  expect(result.targetCount).toBe(3)
  expect(result.coveredTargetCount).toBe(3)
  expect(result.placements).toHaveLength(2)
  expect(result.placements[0].wall).toBe('front')
})
it('uses the wider horizontal span to consolidate a horizontal layout', () => {
  const result = optimizeReflectionPanels([
    { wall: 'front', point: [1.1, 1.3, 0] },
    { wall: 'front', point: [2.1, 1.35, 0] },
  ], { width: 6, height: 3, length: 8 }, 'horizontal')
  expect(result.coveredTargetCount).toBe(2)
  expect(result.placements).toHaveLength(1)
})
it('uses the selected absorber dimensions when grouping panels', () => {
  const targets = [
    { wall: 'front' as const, point: [1.1, 1.3, 0] as [number, number, number] },
    { wall: 'front' as const, point: [2.1, 1.35, 0] as [number, number, number] },
  ]
  const result = optimizeReflectionPanels(targets, { width: 6, height: 3, length: 8 }, 'horizontal', [0.4, 1.4])
  expect(result.coveredTargetCount).toBe(2)
  expect(result.placements).toHaveLength(1)
})

it('finds a whole cluster that no target or pair midpoint can center', () => {
  const result = optimizeReflectionPanels([
    { wall: 'front', point: [1, 1, 0] },
    { wall: 'front', point: [1.9, 1.4, 0] },
    { wall: 'front', point: [1.3, 1.9, 0] },
  ], { width: 6, height: 3, length: 8 }, 'vertical', [1, 1]);
  expect(result.placements).toHaveLength(1);
  expect(result.coveredTargetCount).toBe(3);
});

it('leaves an isolated secondary contact uncovered instead of fragmenting a clustered layout', () => {
  const result = optimizeReflectionPanels([
    { wall: 'front', point: [1, 1.3, 0], weight: 2 },
    { wall: 'front', point: [1.2, 1.4, 0], weight: 2 },
    { wall: 'front', point: [5, 2.5, 0], weight: 0.5 },
  ], { width: 6, height: 3, length: 8 }, 'vertical');
  expect(result.placements).toHaveLength(1);
  expect(result.coveredTargetCount).toBe(2);
  expect(result.targetCount).toBe(3);
});

it('aligns neighboring panels with a practical gap and preserves finite coverage after mounting', async () => {
  const { mountTreatmentAtPoint } = await import('./model');
  const { panelCoversReflection, roomSurfaces } = await import('./acoustics');
  const room = { width: 6, height: 3, length: 8 };
  const targets = [1, 1.7, 2.4].map(x => ({ wall: 'front' as const, point: [x, 1.4, 0] as [number, number, number] }));
  const result = optimizeReflectionPanels(targets, room, 'vertical', [0.6, 1.2]);
  const panels = result.placements.map(p => mountTreatmentAtPoint({ ...makeObject('panel'), size: [0.6, 1.2, 0.1] }, p.wall, p.center, room));
  for (const a of result.placements) for (const b of result.placements) if (a !== b) {
    expect(a.center[1]).toBeCloseTo(b.center[1]);
    expect(Math.abs(a.center[0] - b.center[0])).toBeGreaterThanOrEqual(0.65 - 1e-5);
  }
  expect(targets.filter(t => panels.some(p => panelCoversReflection(p, roomSurfaces(room)[0], t.point))).length).toBe(result.coveredTargetCount);
});

it('does not place panels larger than a room surface', () => {
  const result = optimizeReflectionPanels([{ wall: 'front', point: [1, 1, 0] }], { width: 2, height: 2, length: 3 }, 'vertical', [3, 1]);
  expect(result.placements).toEqual([]);
  expect(result.coveredTargetCount).toBe(0);
});
