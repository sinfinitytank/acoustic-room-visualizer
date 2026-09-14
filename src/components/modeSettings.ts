import type { RoomMode, RoomModeKind } from '../domain/acoustics';

export type ModeSettings = {
  minimum: number; maximum: number; rt60: number;
  kinds: Record<RoomModeKind, boolean>; animate: boolean; nodes: boolean;
};
export const defaultModeSettings: ModeSettings = { minimum: 20, maximum: 160, rt60: 0.21, kinds: { Axial: true, Tangential: true, Oblique: true }, animate: false, nodes: false };
export const modeKinds: RoomModeKind[] = ['Axial', 'Tangential', 'Oblique'];
export const modeLabel = (mode: RoomMode) => `${mode.frequency.toFixed(2)} Hz · ${mode.kind} (${mode.orders.join(', ')})`;
