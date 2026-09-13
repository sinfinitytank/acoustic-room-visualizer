import type { AbsorptionPoint } from '../domain/model'
export default function AbsorptionGraph({points}:{points:AbsorptionPoint[]}) {
 const data=[...new Map(points.filter(p=>Number.isFinite(p.frequency)&&p.frequency>=20&&p.frequency<=20000&&Number.isFinite(p.coefficient)&&p.coefficient>=0&&p.coefficient<=1).map(p=>[p.frequency,p])).values()].sort((a,b)=>a.frequency-b.frequency)
 const x=(f:number)=>48+Math.log10(f/20)/3*392, y=(v:number)=>190-v/1.2*156
 // Shape-preserving cubic interpolation in log-frequency space: no overshoot
 // and no forced horizontal tangent at each measured band.
 const coords=data.map(p=>({x:x(p.frequency),y:y(p.coefficient)}))
 const delta=coords.slice(1).map((p,i)=>(p.y-coords[i].y)/(p.x-coords[i].x))
 const tangent=coords.map((_,i)=>{
   if(i===0)return delta[0]||0
   if(i===coords.length-1)return delta[i-1]||0
   const a=delta[i-1],b=delta[i]
   if(a*b<=0)return 0
   const h0=coords[i].x-coords[i-1].x,h1=coords[i+1].x-coords[i].x
   const w1=2*h1+h0,w2=h1+2*h0
   return (w1+w2)/(w1/a+w2/b)
 })
 const path=coords.map((p,i)=>{
   if(!i)return `M ${p.x} ${p.y}`
   const a=coords[i-1],h=(p.x-a.x)/3
   return `C ${a.x+h} ${a.y+h*tangent[i-1]}, ${p.x-h} ${p.y-h*tangent[i]}, ${p.x} ${p.y}`
 }).join(' ')

 return <figure className="scientific-graph"><figcaption>Absorption by frequency <small>Entered bands · visual interpolation</small></figcaption><svg viewBox="0 0 470 260" role="img" aria-label="Absorption coefficient versus logarithmic frequency">{[0,.3,.6,.9,1.2].map(v=><g key={v}><line x1="48" x2="440" y1={y(v)} y2={y(v)}/><text x="39" y={y(v)+4} textAnchor="end">{v.toFixed(2)}</text></g>)}{[20,100,1000,10000,20000].map(f=><g key={f}><line x1={x(f)} x2={x(f)} y1="34" y2="190"/><text x={x(f)} y="218" textAnchor="middle">{f>=1000?`${f/1000}k`:f}</text></g>)}<text x="244" y="247" textAnchor="middle">Frequency (Hz) · log scale</text><text x="48" y="18">Absorption coefficient</text><path d={path}/>{data.map(p=><circle key={p.frequency} cx={x(p.frequency)} cy={y(p.coefficient)} r="3.5"><title>{p.frequency} Hz: {p.coefficient}</title></circle>)}</svg></figure>
}
