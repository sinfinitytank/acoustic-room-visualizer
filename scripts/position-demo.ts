import {readFileSync,writeFileSync} from 'node:fs'
import {computePaths,solvePath,roomSurfaces} from '../src/domain/acoustics'
import {mountObject} from '../src/domain/model'
import type {Design,Vec3,Wall} from '../src/domain/model'
import {syncSofaListeners} from '../src/domain/workspace'
const data=JSON.parse(readFileSync('public/demo-room.json','utf8'))
const d=syncSofaListeners(data as Design), room=d.room, surfaces=roomSurfaces(room)
const speaker=d.objects.find(o=>o.kind==='speaker')!,listener=d.objects.find(o=>o.kind==='listener')!
const source:Vec3=[speaker.position[0],speaker.position[1]+speaker.tweeter,speaker.position[2]+speaker.size[2]/2+.003]
const treatments=d.objects.filter(o=>o.kind==='panel'||o.kind==='bass')
// Five single-contact placements, followed by two contacts from one valid double reflection.
const targets:{wall:Wall;point:Vec3}[]=[]
for(const wall of ['left','right','front','rear','ceiling'] as Wall[]){const s=surfaces.find(s=>s.id===wall)!;const points=solvePath(source,listener.position,[s],room);if(points)targets.push({wall,point:points[1]})}
const candidates=surfaces.filter(s=>['front','rear','left','right'].includes(s.id))
const found=candidates.flatMap(a=>candidates.filter(b=>b.id!==a.id).map(b=>({pair:[a,b],points:solvePath(source,listener.position,[a,b],room)}))).find(q=>q.points)
if(!found?.points)throw Error('Demo second-order path missing')
targets.push({wall:found.pair[0].id as Wall,point:found.points[1]},{wall:found.pair[1].id as Wall,point:found.points[2]})
treatments.forEach((o,i)=>{
 const {wall,point}=targets[i];const horizontal=wall==='left'||wall==='right'?point[2]:point[0]
 const mounted=mountObject({...o,kind:'panel',mount:wall,offset:Math.max(0,horizontal-o.size[0]/2),bottom:Math.max(0,point[1]-o.size[1]/2),ceilingOffset:Math.max(0,point[2]-o.size[1]/2)},room)
 Object.assign(o,mounted,{kind:o.kind,name:i<5?`Absorber ${i+1}`:`Bass trap ${i-4}`})
 // Bass traps here are wall-mounted broadband traps, not diagonal corner wedges.
 if(i>=5){o.kind='bass';o.mount='free'}
})
const settings={enabled:true,first:true,second:true,allListeners:true,listener:listener.id,band:'500' as const,frequency:500,surfaces:{front:true,rear:true,left:true,right:true,floor:true,ceiling:true},maxSecond:100,quality:'high' as const}
const paths=computePaths(d,settings,{panel:true,bass:true})
const first=paths.filter(p=>p.order===1&&p.surfaces.some(s=>/Absorber|Bass trap/.test(s)))
const two=paths.filter(p=>p.order===2&&p.surfaces.some(s=>/Absorber|Bass trap/.test(s)))
if(!first.length||!two.length)throw Error('Demo requires both first and second treatment paths')
writeFileSync('public/demo-room.json',JSON.stringify({...data,...d},null,2)+'\n')
console.log(`Demo verified: ${first.length} first-order and ${two.length} second-order paths contact treatments.`)
