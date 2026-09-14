import { describe, expect, it } from 'vitest';
import { calculateRoomModes, nearestRoomMode, roomModePressure, schroederFrequency } from './acoustics';
const room = { length: 5, width: 4, height: 3 };

describe('rectangular room modes', () => {
  it('matches the reference room fundamentals, mixed modes and Schroeder marker', () => {
    const modes = calculateRoomModes(room, 160);
    expect(modes.slice(0, 3).map(m => m.id)).toEqual(['1-0-0', '0-1-0', '1-1-0']);
    expect(modes.find(m => m.id === '1-0-0')?.frequency).toBeCloseTo(34.3, 8);
    expect(modes.find(m => m.id === '0-1-0')?.frequency).toBeCloseTo(42.875, 8);
    expect(modes.find(m => m.id === '0-0-1')?.frequency).toBeCloseTo(57.1666667, 6);
    expect(modes.find(m => m.id === '1-1-0')?.kind).toBe('Tangential');
    expect(modes.find(m => m.id === '1-1-1')?.kind).toBe('Oblique');
    expect(modes.find(m => m.id === '1-1-1')?.frequency).toBeCloseTo(79.263, 2);
    expect(schroederFrequency(room, 0.21)).toBeCloseTo(118.3215957, 6);
    expect(schroederFrequency(room, 0.84)).toBeCloseTo(2 * schroederFrequency(room, 0.21), 8);
  });
  it('preserves coincident modes and excludes the zero mode', () => {
    const modes = calculateRoomModes({ length: 5, width: 5, height: 5 }, 35);
    expect(modes).toHaveLength(3);
    expect(new Set(modes.map(m => m.id)).size).toBe(3);
    for (const mode of modes) expect(mode.frequency).toBeCloseTo(34.3, 8);
  });
  it('includes cutoff modes and high harmonics without an arbitrary order cap', () => {
    const modes = calculateRoomModes({ length: 30, width: 1, height: 1 }, 300);
    expect(modes.some(m => m.id === '52-0-0')).toBe(true);
    expect(calculateRoomModes(room, 34.3).map(m => m.id)).toEqual(['1-0-0']);
    for (let i = 1; i < modes.length; i++) expect(modes[i].frequency).toBeGreaterThanOrEqual(modes[i - 1].frequency);
    expect(modes.every(m => m.frequency <= 300)).toBe(true);
  });
  it('maps L/W/H orders to world Z/X/Y and pressure nodes correctly', () => {
    const modes = calculateRoomModes(room);
    const lengthMode = modes.find(m => m.id === '1-0-0')!;
    const widthMode = modes.find(m => m.id === '0-1-0')!;
    const heightMode = modes.find(m => m.id === '0-0-1')!;
    expect(roomModePressure(room, lengthMode, [2, 1.5, 0])).toBe(1);
    expect(roomModePressure(room, lengthMode, [2, 1.5, 2.5])).toBeCloseTo(0, 10);
    expect(roomModePressure(room, lengthMode, [2, 1.5, 5])).toBe(-1);
    expect(roomModePressure(room, widthMode, [2, 0, 0])).toBeCloseTo(0, 10);
    expect(roomModePressure(room, heightMode, [0, 1.5, 0])).toBeCloseTo(0, 10);
    const mixed = modes.find(m => m.id === '1-1-1')!;
    expect(roomModePressure(room, mixed, [0, 0, 0])).toBe(1);
    expect(roomModePressure(room, mixed, [4, 3, 5])).toBe(-1);
  });
  it('recalculates frequencies from room dimensions', () => {
    const original = calculateRoomModes(room).find(m => m.id === '1-0-0')!;
    const longer = calculateRoomModes({ ...room, length: 10 }).find(m => m.id === '1-0-0')!;
    expect(longer.frequency).toBe(original.frequency / 2);
  });
  it('finds nearest modes and handles empty or invalid calculations', () => {
    const modes = calculateRoomModes(room, 60);
    expect(nearestRoomMode(modes, 42)?.id).toBe('0-1-0');
    expect(nearestRoomMode(modes, 0)).toBe(modes[0]);
    expect(nearestRoomMode(modes, 1000)).toBe(modes.at(-1));
    expect(nearestRoomMode([], 100)).toBeUndefined();
    expect(calculateRoomModes(room, 20)).toEqual([]);
    for (const maximum of [NaN, Infinity, -1, 301]) expect(calculateRoomModes(room, maximum)).toEqual([]);
    expect(calculateRoomModes({ ...room, width: 0 })).toEqual([]);
    expect(schroederFrequency(room, NaN)).toBe(0);
  });
});
