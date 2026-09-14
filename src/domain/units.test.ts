import { expect, it } from 'vitest';
import { distanceLabel, fromUnit, toUnit, ft, inches, makeObject } from './model';
it('uses 30 cm per foot and 12 inches per foot for every shared conversion', () => {
  expect(ft(1)).toBe(0.3);
  expect(toUnit(ft(1), 'cm')).toBe(30);
  expect(toUnit(ft(1), 'in')).toBe(12);
  expect(inches(12)).toBe(ft(1));
  for (const unit of ['ft', 'cm', 'in'] as const) expect(toUnit(fromUnit(23.5, unit), unit)).toBeCloseTo(23.5);
  expect(distanceLabel(ft(1), 'in')).toBe('12.0 in');
  expect(distanceLabel(ft(1), 'cm')).toBe('30.0 cm');
  expect(makeObject('panel').size[2]).toBe(inches(4));
});
