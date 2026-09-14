import {useMemo,useRef,useEffect} from 'react'
import {useFrame} from '@react-three/fiber'
import {Color,Matrix4,Vector3} from 'three'
import type {InstancedMesh} from 'three'
import type {ReflectionPath} from '../domain/model'
export default function RayMotion({paths}:{paths:ReflectionPath[]}) {
 const ref=useRef<InstancedMesh>(null)
 const cycleStart=useRef(0)
 const matrix=useMemo(()=>new Matrix4(),[]), position=useMemo(()=>new Vector3(),[])
 const routes=useMemo(()=>paths.map(path=>{const lengths=path.points.slice(1).map((p,i)=>new Vector3(...p).distanceTo(new Vector3(...path.points[i])));return {path,lengths,total:lengths.reduce((a,b)=>a+b,0)}}),[paths])
 useEffect(()=>{
  if (!ref.current) return
  routes.forEach((route,i)=>{
   const p=route.path.points[0]
   matrix.makeTranslation(p[0],p[1],p[2])
   ref.current!.setMatrixAt(i,matrix)
   ref.current!.setColorAt(i,new Color(route.path.color).multiplyScalar(Math.max(0.04, route.path.segmentEnergies?.[0] ?? route.path.energy)))
  })
  ref.current.instanceMatrix.needsUpdate=true
  if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true
  cycleStart.current=0
 },[routes,matrix])
 useFrame(({clock})=>{
  if(!ref.current)return
  if (!cycleStart.current) cycleStart.current=clock.elapsedTime
  // All markers share one cycle. A shorter path stays at its listener until
  // the longest path arrives, so the next set always starts together.
  const speed=1.5
  const longest=Math.max(...routes.map(route=>route.total),0)
  const phase=((clock.elapsedTime-cycleStart.current)%(longest/speed || 1))*speed
  routes.forEach(({path,lengths,total},i)=>{
   if (!total) return
   let travel=Math.min(phase,total)
   let segment=0
   while(segment<lengths.length-1&&travel>lengths[segment]){travel-=lengths[segment];segment++}
   const a=path.points[segment],b=path.points[segment+1],t=travel/(lengths[segment]||1)
   position.set(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t)
   matrix.makeTranslation(position.x,position.y,position.z);ref.current!.setMatrixAt(i,matrix)
   ref.current!.setColorAt(i,new Color(path.color).multiplyScalar(Math.max(0.3, path.segmentEnergies?.[segment] ?? path.energy)))
  })
  ref.current.instanceMatrix.needsUpdate=true
  if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true
 })
 if(!paths.length)return null
 return <instancedMesh key={paths.map(p=>p.id).join('|')} ref={ref} args={[undefined,undefined,paths.length]} frustumCulled={false} renderOrder={11} raycast={()=>null}><sphereGeometry args={[.025,8,6]}/><meshBasicMaterial depthTest depthWrite={false} toneMapped={false}/></instancedMesh>
}
