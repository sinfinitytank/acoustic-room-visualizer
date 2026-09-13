import { create } from 'zustand'
import { demo, makeObject, mountObject } from './model'
import type { Design, Kind, RoomObject, Vec3 } from './model'
import { initialWorkspace, instantiate, syncSofaListeners, WORKSPACE_KEY } from './workspace'
import type { LibraryItem, Snapshot, Workspace } from './workspace'
interface Store extends Workspace {
  past: Snapshot[]; future: Snapshot[]; selected: string | null; dragStart: Snapshot | null; storageError: boolean;
  commit: (d: Design) => void; select: (id: string | null) => void;
  patch: (id: string, p: Partial<RoomObject>) => void; move: (id: string, pos: Vec3, rot: Vec3) => void;
  beginDrag: () => void; previewMove: (id: string, pos: Vec3, rot: Vec3) => void; endDrag: () => void;
  add: (kind: Kind) => string; place: (id: string) => string | null;
  saveLibraryItem: (item: LibraryItem, apply?: boolean) => void; deleteLibraryItem: (id: string) => void;
  saveMilestone: (label?: string) => boolean; restoreMilestone: (id: string) => boolean; deleteMilestone: (id: string) => boolean; deleteAllMilestones: () => boolean;
  importWorkspace: (w: Workspace) => void; persist: () => void;
  remove: () => void; duplicate: () => void; resetObject: () => void; undo: () => void; redo: () => void;
}
const snapshot = (s: Snapshot): Snapshot => ({ design: s.design, library: s.library })
export const workspaceData = (s: Workspace): Workspace => ({ version: 2, design: s.design, library: s.library, milestones: s.milestones, activeMilestoneId: s.activeMilestoneId })
const write = (s: Workspace) => { try { localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspaceData(s))); return false } catch { return true } }
export const useStudio = create<Store>((set, get) => ({ ...initialWorkspace(), past: [], future: [], selected: null, dragStart: null, storageError: false,
  persist: () => set({ storageError: write(get()) }),
  beginDrag: () => set({ dragStart: structuredClone(snapshot(get())) }),
  previewMove: (id, position, rotation) => set(s => ({ design: syncSofaListeners({ ...s.design, objects: s.design.objects.map(o => o.id === id && !o.parentSofaId ? { ...o, position: [position[0], o.kind === 'sofa' ? 0 : position[1], position[2]], rotation, mount: o.kind === 'panel' || o.kind === 'bass' ? o.mount : 'free', ...(o.kind === 'speaker' ? { stand: { ...o.stand, height: Math.max(0, position[1]) } } : {}) } : o) }) })),
  endDrag: () => { set(s => s.dragStart ? ({ past: [...s.past.slice(-49), s.dragStart], future: [], dragStart: null }) : {}); get().persist() },
  commit: d => { set(s => ({ design: syncSofaListeners(d), past: [...s.past.slice(-49), snapshot(s)], future: [] })); get().persist() },
  select: selected => set({ selected }),
  patch: (id, p) => { const s = get(); s.commit({ ...s.design, objects: s.design.objects.map(o => o.id === id ? o.parentSofaId ? { ...o, visible: p.visible ?? o.visible } : mountObject({ ...o, ...p }, s.design.room) : o) }) },
  move: (id, position, rotation) => { const s = get(), o = s.design.objects.find(q => q.id === id); s.patch(id, { position, rotation, mount: 'free', ...(o?.kind === 'speaker' ? { stand: { ...o.stand, height: Math.max(0, position[1]) } } : {}) }) },
  add: kind => { const s = get(); const item = s.library.find(q => q.kind === kind); if (item) return s.place(item.id)!; const o = makeObject(kind); s.commit({ ...s.design, objects: [...s.design.objects, o] }); s.select(o.id); return o.id },
  place: id => { const s = get(), item = s.library.find(q => q.id === id); if (!item || s.design.objects.length + (item.kind === 'sofa' ? 3 : 1) > 150) return null; const o = instantiate(item, s.design, s.library); s.commit({ ...s.design, objects: [...s.design.objects, o] }); s.select(o.id); return o.id },
  saveLibraryItem: (item, apply = false) => { const s = get(); const library = s.library.some(q => q.id === item.id) ? s.library.map(q => q.id === item.id ? structuredClone(item) : q) : [...s.library, structuredClone(item)]; let design = s.design;
    if (apply) design = syncSofaListeners({ ...design, objects: design.objects.map(o => {
      if (o.templateId !== item.id) return o
      const defaults = instantiate(item, design, library)
      return mountObject({ ...o, size: [...item.size] as Vec3, absorption: { ...item.absorption }, curve: item.curve ? structuredClone(item.curve) : o.curve, color: item.color, stand: defaults.stand, tweeter: item.tweeter, ...(o.kind === 'speaker' ? { position: [o.position[0], defaults.stand.height, o.position[2]] as Vec3 } : {}) }, design.room)
    }) });
    set({ design, library, past: [...s.past.slice(-49), snapshot(s)], future: [] }); get().persist()
  },
  deleteLibraryItem: id => { const s = get(); set({ library: s.library.filter(q => q.id !== id).map(q => q.standTemplateId === id ? { ...q, standTemplateId: undefined } : q), past: [...s.past.slice(-49), snapshot(s)], future: [] }); get().persist() },
  saveMilestone: label => { const s = get(); const m = { ...structuredClone(snapshot(s)), id: crypto.randomUUID(), label: label?.trim().slice(0, 100) || `Save ${s.milestones.length + 1}`, createdAt: new Date().toISOString(), parentId: s.activeMilestoneId }; const next = { ...s, milestones: [...s.milestones, m], activeMilestoneId: m.id }; if (write(next)) { set({ storageError: true }); return false } set({ milestones: next.milestones, activeMilestoneId: m.id, storageError: false }); return true },
  restoreMilestone: id => { let s = get(); const m = s.milestones.find(q => q.id === id); if (!m) return false; const active = s.milestones.find(q => q.id === s.activeMilestoneId); if (!active || JSON.stringify(snapshot(active)) !== JSON.stringify(snapshot(s))) { if (!s.saveMilestone('Before history jump')) return false; s = get() } const next = { ...s, ...structuredClone(snapshot(m)), activeMilestoneId: m.id }; if (write(next)) { set({ storageError: true }); return false } set({ ...snapshot(next), activeMilestoneId: m.id, selected: null, past: [...s.past.slice(-49), snapshot(s)], future: [], storageError: false }); return true },
  deleteAllMilestones: () => { const next = {...get(), milestones: [], activeMilestoneId: null}; if(write(next)){set({storageError:true});return false} set({milestones:[],activeMilestoneId:null,storageError:false});return true },
  deleteMilestone: id => { const s = get(); if (!s.milestones.some(m => m.id === id)) return false; const milestones = s.milestones.filter(m => m.id !== id).map(m => m.parentId === id ? { ...m, parentId: null } : m); const activeMilestoneId = s.activeMilestoneId === id ? null : s.activeMilestoneId; const next = { ...s, milestones, activeMilestoneId }; if (write(next)) { set({ storageError: true }); return false } set({ milestones, activeMilestoneId, storageError: false }); return true },
  importWorkspace: w => { const s = get(); const legacyStands = new Map(w.library.filter(item => item.kind === 'stand').map(item => [item.id, item])); const library = w.library.filter(item => item.kind !== 'stand'); const design = syncSofaListeners({ ...w.design, objects: w.design.objects.map(o => { const stand = o.standTemplateId ? legacyStands.get(o.standTemplateId) : undefined; return o.kind === 'speaker' ? { ...o, stand: stand ? { height: stand.size[1], width: stand.size[0], depth: stand.size[2], postWidth: stand.stand.postWidth || o.stand.postWidth } : o.stand, standTemplateId: undefined } : o }) }); const mapping = new Map(w.milestones.map(m => [m.id, crypto.randomUUID()])); const imported = w.milestones.map(m => ({ ...m, id: mapping.get(m.id)!, parentId: m.parentId ? mapping.get(m.parentId)! : null })); set({ design, library, milestones: [...s.milestones, ...imported], activeMilestoneId: w.activeMilestoneId ? mapping.get(w.activeMilestoneId)! : null, past: [...s.past.slice(-49), snapshot(s)], future: [], selected: null }); get().persist() },
  remove: () => { const s = get(), o = s.design.objects.find(q => q.id === s.selected); if (!o || o.parentSofaId) return; s.commit({ ...s.design, objects: s.design.objects.filter(q => q.id !== o.id && q.parentSofaId !== o.id), measurements: s.design.measurements.filter(m => m.a.objectId !== o.id && m.b.objectId !== o.id) }); s.select(null) },
  duplicate: () => { const s = get(), o = s.design.objects.find(q => q.id === s.selected); if (!o || o.parentSofaId) return; const copy = { ...structuredClone(o), id: crypto.randomUUID(), name: `${o.name.slice(0, 90)} copy`, mount: 'free' as const, position: [o.position[0] + 0.2, o.position[1], o.position[2] + 0.2] as Vec3 }; s.commit({ ...s.design, objects: [...s.design.objects, copy] }); s.select(copy.id) },
  resetObject: () => { const s = get(), o = s.design.objects.find(q => q.id === s.selected); if (!o || o.parentSofaId) return; const item = s.library.find(q => q.id === o.templateId); const original = item ? { ...instantiate(item, s.design, s.library), id: o.id } : demo().objects.find(q => q.id === o.id) || makeObject(o.kind, o.id); s.patch(o.id, original) },
  undo: () => { set(s => { const prev = s.past.at(-1); return prev ? { ...prev, past: s.past.slice(0, -1), future: [snapshot(s), ...s.future] } : {} }); get().persist() },
  redo: () => { set(s => { const next = s.future[0]; return next ? { ...next, past: [...s.past, snapshot(s)], future: s.future.slice(1) } : {} }); get().persist() },
}))
