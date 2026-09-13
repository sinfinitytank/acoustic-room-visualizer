import { expect, it } from 'vitest'
import { snapToSurface } from './placement'
import { makeObject } from './model'
it('snaps furniture to floor and far wall using its bounds', () => { const sofa = makeObject('sofa', 's'); const r = { width: 5, height: 3, length: 6 }; expect(snapToSurface(sofa, r, 'floor')[1]).toBe(0); expect(snapToSurface(sofa, r, 'rear')[2]).toBeCloseTo(6 - sofa.size[2] / 2) })
it('snaps a rotated panel by its rotated bounds', () => { const panel = makeObject('panel', 'p'); panel.rotation = [0, Math.PI / 2, 0]; expect(snapToSurface(panel, { width: 5, height: 3, length: 6 }, 'left')[0]).toBeCloseTo(panel.size[2] / 2) })
