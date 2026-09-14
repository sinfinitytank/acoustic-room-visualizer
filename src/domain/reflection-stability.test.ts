import { expect, it } from 'vitest'
import { computePaths } from './acoustics'
import type { RaySettings } from './acoustics'
import { demo, makeObject, mountTreatmentAtPoint, walls } from './model'

const settings: RaySettings = { enabled: true, first: true, second: true, listener: '', listeners: { a: true, b: true }, band: '1000', maxSecond: 24, quality: 'high', surfaces: { front: true, rear: true, left: true, right: true, floor: true, ceiling: true } }
it('preserves all contact points, wall sequences and animation routes through panel toggles', () => {
  const d = demo();
  const trace = () => computePaths(d, settings, { panel: true, bass: true });
  const geometry = (paths: ReturnType<typeof trace>) => paths.map(({ id, points, surfaces, length }) => ({ id, points, surfaces, length }));
  const before = trace();
  for (const wall of walls) d.objects.push(mountTreatmentAtPoint({ ...makeObject('panel'), size: [10, 10, 0.1016] }, wall, [2, 1, 2], d.room));
  const on = trace();
  expect(geometry(on)).toEqual(geometry(before));
  expect(on.some((p, i) => p.energy < before[i].energy)).toBe(true);
  for (const panel of d.objects.filter(o => o.kind === 'panel')) panel.reflect = false;
  const off = trace();
  expect(geometry(off)).toEqual(geometry(before));
  expect(off.map(p => p.energy)).toEqual(before.map(p => p.energy));
  expect(computePaths(d, settings, { panel: false, bass: true })).toEqual(off);
});

it('classifies real contact coverage independently of absorption and respects treatment state', async () => {
  const { matchesRayCoverage } = await import('./acoustics');
  const d = demo();
  const trace = () => computePaths(d, settings, { panel: true, bass: true });
  const target = trace().find(p => p.order === 2)!;
  const wall = walls.find(w => target.id.split(':').includes(w))!;
  const panel = mountTreatmentAtPoint({ ...makeObject('panel'), size: [0.3, 0.3, 0.1], curve: [{ frequency: 1000, coefficient: 0 }] }, wall, target.points[1], d.room);
  d.objects.push(panel);
  const mixed = trace().find(p => p.id === target.id)!;
  expect(mixed.reflectionCoverage).toEqual([true, false]);
  expect(mixed.energy).toBe(1);
  expect(matchesRayCoverage(mixed, 'untreated')).toBe(false);
  expect(matchesRayCoverage(mixed, 'treated')).toBe(true);
  const secondWall = target.id.split(':').at(-1) as typeof walls[number];
  const secondPanel = mountTreatmentAtPoint({ ...makeObject('panel'), size: [0.3, 0.3, 0.1] }, secondWall, target.points[2], d.room);
  d.objects.push(secondPanel);
  const covered = trace().find(p => p.id === target.id)!;
  expect(covered.reflectionCoverage).toEqual([true, true]);
  expect(matchesRayCoverage(covered, 'treated')).toBe(true);
  expect(matchesRayCoverage(covered, 'untreated')).toBe(false);
  panel.reflect = false;
  const secondOnly = trace().find(p => p.id === target.id)!;
  expect(secondOnly.reflectionCoverage).toEqual([false, true]);
  expect(matchesRayCoverage(secondOnly, 'treated')).toBe(true);
  expect(matchesRayCoverage(secondOnly, 'untreated')).toBe(false);
  d.objects.pop();
  expect(matchesRayCoverage(trace().find(p => p.id === target.id)!, 'untreated')).toBe(true);
  for (const coverage of [[true, false, false], [false, true, false], [false, false, true], [false, false, false], []]) {
    const path = { ...target, reflectionCoverage: coverage };
    expect(matchesRayCoverage(path, 'treated')).toBe(coverage.includes(true));
    expect(matchesRayCoverage(path, 'untreated')).toBe(coverage.length > 0 && !coverage.includes(true));
    expect(matchesRayCoverage(path, 'all')).toBe(true);
  }
  expect(trace().find(p => p.id === target.id)!.reflectionCoverage).toEqual([false, false]);
  panel.reflect = true;
  panel.offset += 1;
  Object.assign(panel, (await import('./model')).mountObject(panel, d.room));
  expect(trace().find(p => p.id === target.id)!.reflectionCoverage).toEqual([false, false]);
});

it('controls direct paths independently while preserving reflection and speaker participation', () => {
  const d = demo(), layers = { panel: true, bass: true };
  const on = computePaths(d, { ...settings, direct: true }, layers);
  const off = computePaths(d, { ...settings, direct: false }, layers);
  expect(off).toEqual(on.filter(p => p.points.length > 2));
  d.objects.find(o => o.id === 'speaker-left')!.reflect = false;
  const direct = computePaths(d, { ...settings, direct: true, first: false, second: false }, layers);
  expect(direct.length).toBe(2);
  expect(direct.every(p => p.source === 'Right speaker')).toBe(true);
});

it('checks finite mounted footprints on every room surface, including moved and rotated geometry', async () => {
  const { panelCoversReflection, roomSurfaces, add, scale } = await import('./acoustics');
  const room = { width: 6, height: 3, length: 8 };
  for (const wall of roomSurfaces(room)) {
    const panel = mountTreatmentAtPoint({ ...makeObject('panel'), size: [0.6, 1.2, 0.1] }, wall.id as typeof walls[number], wall.center, room);
    expect(panelCoversReflection(panel, wall, wall.center)).toBe(true);
    expect(panelCoversReflection(panel, wall, add(wall.center, scale(wall.u, 0.3)))).toBe(true);
    expect(panelCoversReflection(panel, wall, add(wall.center, scale(wall.u, 0.301)))).toBe(false);
    expect(panelCoversReflection({ ...panel, position: add(panel.position, scale(wall.normal, 0.2)) }, wall, wall.center)).toBe(false);
    expect(panelCoversReflection({ ...panel, mount: 'free' }, wall, wall.center)).toBe(false);
  }
  const wall = roomSurfaces(room)[0];
  const panel = mountTreatmentAtPoint({ ...makeObject('panel'), size: [0.6, 1.2, 0.1] }, 'front', wall.center, room);
  panel.rotation = [0, 0, Math.PI / 2];
  expect(panelCoversReflection(panel, wall, add(wall.center, [0.5, 0, 0]))).toBe(true);
  expect(panelCoversReflection(panel, wall, add(wall.center, [0, 0.5, 0]))).toBe(false);
  panel.rotation = [0, Math.PI / 4, 0];
  expect(panelCoversReflection(panel, wall, wall.center)).toBe(false);
});

it('updates coverage filters and attenuation when a mounted panel is detached from its wall', async () => {
  const { matchesRayCoverage, roomSurfaces, add, scale } = await import('./acoustics');
  const d = demo();
  const trace = () => computePaths(d, settings, { panel: true, bass: true });
  const target = trace().find(p => p.points.length === 3)!;
  const wall = roomSurfaces(d.room).find(w => w.name === target.surfaces[0])!;
  const panel = mountTreatmentAtPoint({ ...makeObject('panel'), size: [0.4, 0.4, 0.1] }, wall.id as typeof walls[number], target.points[1], d.room);
  d.objects.push(panel);
  expect(matchesRayCoverage(trace().find(p => p.id === target.id)!, 'treated')).toBe(true);
  panel.position = add(panel.position, scale(wall.normal, 0.5));
  const detached = trace().find(p => p.id === target.id)!;
  expect(matchesRayCoverage(detached, 'treated')).toBe(false);
  expect(matchesRayCoverage(detached, 'untreated')).toBe(true);
  expect(detached.energy).toBe(1);
});
