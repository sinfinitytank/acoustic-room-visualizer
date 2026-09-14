import { beforeEach, describe, expect, it } from 'vitest'
import { useStudio } from './store'
import { demo } from './model'
import { defaultLibrary, WORKSPACE_KEY } from './workspace'
const data = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: { setItem: (k: string, v: string) => data.set(k, v), getItem: (k: string) => data.get(k) || null }, configurable: true })
beforeEach(() => { data.clear(); useStudio.setState({ design: demo(), library: defaultLibrary(), milestones: [], activeMilestoneId: null, past: [], future: [], selected: null, dragStart: null }) })
describe('persistent synchronized editing', () => {
  it('commits a viewport move, stand height, local storage, undo and redo together', () => { const s = useStudio.getState(); s.move('speaker-left', [1.5, 0.8, 1.2], [0, 0.2, 0]); const o = useStudio.getState().design.objects[0]; expect(o.position).toEqual([1.5, 0.8, 1.2]); expect(o.stand.height).toBe(0.8); expect(JSON.parse(data.get(WORKSPACE_KEY)!).design.objects[0].position).toEqual(o.position); s.undo(); expect(useStudio.getState().design.objects[0].position).toEqual(demo().objects[0].position); s.redo(); expect(useStudio.getState().design.objects[0].position).toEqual(o.position) })
  it('updates live during a drag and groups the gesture into one undo entry', () => { const s = useStudio.getState(); s.beginDrag(); s.previewMove('speaker-left', [2, 1, 2], [0, 0, 0]); expect(useStudio.getState().design.objects[0].position).toEqual([2, 1, 2]); s.previewMove('speaker-left', [2.2, 1, 2], [0, 0, 0]); s.endDrag(); expect(useStudio.getState().past).toHaveLength(1); s.undo(); expect(useStudio.getState().design.objects[0].position).toEqual(demo().objects[0].position) })
  it('duplicates and deletes objects without leaving dangling measurement anchors', () => { const s = useStudio.getState(); s.select('speaker-left'); s.duplicate(); const id = useStudio.getState().selected!; expect(useStudio.getState().design.objects).toHaveLength(6); const d = useStudio.getState().design; s.commit({ ...d, measurements: [{ id: 'm', a: { point: [0, 0, 0], objectId: id }, b: { point: [1, 1, 1] } }] }); s.remove(); expect(useStudio.getState().design.measurements).toHaveLength(0) })
})

it('round-trips a library with validation, persistence and undo without changing placed objects', async () => {
  const { exportLibrary, parseLibraryFile } = await import('./workspace');
  const s = useStudio.getState(), before = structuredClone(s.library), design = structuredClone(s.design);
  const library = [{ ...before[0], name: 'Custom export', thicknessMode: 'custom', size: [0.9, 1.5, 0.125] as [number, number, number] }];
  const restored = parseLibraryFile(JSON.parse(JSON.stringify(exportLibrary(library))));
  s.importLibrary(restored);
  expect(useStudio.getState().library).toEqual(library);
  expect(useStudio.getState().design).toEqual(design);
  expect(JSON.parse(data.get(WORKSPACE_KEY)!).library).toEqual(library);
  s.undo(); expect(useStudio.getState().library).toEqual(before);
  s.redo(); expect(useStudio.getState().library).toEqual(library);
  expect(() => s.importLibrary([{}, {}])).toThrow();
  expect(useStudio.getState().library).toEqual(library);
  s.importLibrary([]); expect(useStudio.getState().library).toEqual([]);
});
