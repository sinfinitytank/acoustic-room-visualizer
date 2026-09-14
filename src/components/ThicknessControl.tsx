import type { RoomObject } from '../domain/model'
import { absorptionForCurve, curveForThickness, inches, toUnit } from '../domain/model'
export default function ThicknessControl({ object, onChange }: { object: RoomObject; onChange: (patch: Partial<Pick<RoomObject, "size" | "curve" | "absorption" | "thicknessMode">>) => void }) {
 const mode = object.thicknessMode || ([2,4,6].find(n => Math.abs(object.size[2]-inches(n))<1e-6)?.toString() ?? 'custom')
 const change = (thickness: number, thicknessMode: string, preset = false) => {
 const curve = preset ? curveForThickness(thickness) : object.curve
 onChange({size:[object.size[0],object.size[1],thickness], thicknessMode, ...(curve ? {curve, absorption: absorptionForCurve(curve)} : {})})
 }
 return <div className="thickness-control"><span>Thickness</span><div className="segmented" role="group" aria-label="Treatment thickness">{[2,4,6,'custom'].map(n=><button type="button" key={n} aria-pressed={mode===String(n)} onClick={()=>change(inches(n==='custom'?4:Number(n)),String(n),n!=='custom')}>{n==='custom'?'Custom':`${n}″`}</button>)}</div>{mode==='custom' && <label className="text-field">Custom thickness (inches)<input aria-label="Custom thickness" type="number" min="0.25" max="24" step="0.25" value={Number((toUnit(object.size[2], 'in')).toFixed(4))} onChange={e=>{const n=Number(e.target.value);if(n>=.25&&n<=24)change(inches(n),'custom')}}/></label>}</div>
}
