import RayMotion from './RayMotion'
import { Component, Suspense, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Billboard, Edges, Grid, Html, Line, OrbitControls, TransformControls } from '@react-three/drei'
import { Color, DoubleSide, Group } from 'three'
import type { OrbitControls as OrbitType } from 'three-stdlib'
import { useStudio } from '../domain/store'
import { distanceLabel } from '../domain/model'
import type { Anchor, ReflectionPath, RoomObject, Vec3 } from '../domain/model'
import { add, distance, roomSurfaces } from '../domain/acoustics'
export type Display = { transparent: boolean; grid: boolean; axes: boolean; dimensions: boolean; wallMeasures: boolean; custom: boolean; measurements: boolean; labels: boolean; panel: boolean; bass: boolean }
export type SceneProps = { theme: 'dark' | 'light'; onObjectSelected?: () => void; display: Display; view: string; cameraRevision: number; mode: 'translate' | 'rotate'; snap: number; paths: ReflectionPath[]; selectedRay: string | null; onRay: (id: string) => void; measuring: boolean; onPoint: (a: Anchor) => void; unit: 'ft' | 'cm' }
function Cube({ p = [0, 0, 0], s, color, selected = false }: { p?: Vec3; s: Vec3; color: string; selected?: boolean }) { return <mesh position={p} castShadow receiveShadow><boxGeometry args={s} /><meshStandardMaterial color={color} roughness={0.76} />{selected && <Edges color="#b9f1d5" />}</mesh> }
function Driver({ y, radius }: { y: number; radius: number }) { return <group position={[0, y, 0]}><mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[radius, radius, 0.012, 32]} /><meshStandardMaterial color="#171d21" metalness={0.25} roughness={0.55} /></mesh><mesh position={[0, 0, 0.008]}><sphereGeometry args={[radius * 0.35, 20, 12]} /><meshStandardMaterial color="#53606a" metalness={0.6} roughness={0.4} /></mesh></group> }
function ObjectModel({ o, selected }: { o: RoomObject; selected: boolean }) {
  const [w, h, d] = o.size
  if (o.kind === 'speaker') return <><Cube p={[0, h / 2, 0]} s={o.size} color={o.color} selected={selected} /><Cube p={[0, h / 2, d / 2 + 0.001]} s={[w * 0.93, h * 0.94, 0.014]} color="#2b3030" /><group position={[0, 0, d / 2 + 0.015]}><Driver y={h * 0.35} radius={w * 0.33} /><Driver y={Math.min(h * 0.86, o.tweeter)} radius={w * 0.13} /></group><Cube p={[0, -o.stand.height / 2, 0]} s={[o.stand.postWidth || 0.065, Math.max(0.01, o.stand.height), o.stand.postWidth || 0.065]} color="#343b40" /><Cube p={[0, -o.stand.height + 0.025, 0]} s={[o.stand.width || w * 1.4, 0.045, o.stand.depth || d * 1.2]} color="#252d31" /><Cube p={[0, -0.025, 0]} s={[w, 0.04, d]} color="#343b40" /></>
  if (o.kind === 'stand') return <><Cube p={[0, h / 2, 0]} s={[o.stand.postWidth || 0.065, h, o.stand.postWidth || 0.065]} color={o.color} selected={selected} /><Cube p={[0, 0.025, 0]} s={[w, 0.05, d]} color={o.color} /><Cube p={[0, h, 0]} s={[w * 0.8, 0.04, d * 0.8]} color={o.color} /></>
  if (o.kind === 'sofa') return <><Cube p={[0, h * 0.3, 0]} s={[w, h * 0.4, d]} color={o.color} selected={selected} /><Cube p={[0, h * 0.65, d * 0.38]} s={[w, h * 0.7, d * 0.22]} color={o.color} />{[-1, 1].map(k => <group key={k}><Cube p={[k * w * 0.46, h * 0.45, 0]} s={[w * 0.08, h * 0.5, d]} color={o.color} /><Cube p={[k * w * 0.225, h * 0.52, -0.05]} s={[w * 0.43, h * 0.12, d * 0.72]} color="#83938a" /></group>)}</>
  if (o.kind === 'listener') return <><mesh><sphereGeometry args={[0.095, 20, 16]} /><meshStandardMaterial color={o.color} emissive={o.color} emissiveIntensity={selected ? 0.8 : 0.2} /></mesh><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.16, 0.009, 8, 32]} /><meshBasicMaterial color={o.color} /></mesh></>
  return <><Cube s={o.size} color={o.color} selected={selected} /><Cube p={[0, 0, -d / 2]} s={[w + 0.025, h + 0.025, 0.025]} color="#414b45" /></>
}
function Label({ p, children }: { p: Vec3; children: ReactNode }) { return <Billboard position={p}><Html center style={{ pointerEvents: 'none' }}><span className="scene-label">{children}</span></Html></Billboard> }
function Measure({ a, b, unit, color = '#bccfbc' }: { a: Vec3; b: Vec3; unit: 'ft' | 'cm'; color?: string }) { return <><Line points={[a, b]} color={color} lineWidth={1} dashed dashSize={0.08} gapSize={0.045} /><Label p={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.06, (a[2] + b[2]) / 2]}>{distanceLabel(distance(a, b), unit)}</Label></> }
function rayOpacity(path: ReflectionPath, segment: number) { return path.surfaces[0] === 'Direct / incident' ? 1 : Math.max(0.04, Math.min(1, path.segmentEnergies?.[segment] ?? path.energy)) }
function rayColor(path: ReflectionPath, segment: number, theme: 'dark' | 'light') {
  const base = theme === 'light' ? path.color === '#69d4bf' ? '#087d69' : '#7646b6' : path.color
  return new Color(base).multiplyScalar(rayOpacity(path, segment))
}
function EditableObject({ o, props }: { o: RoomObject; props: SceneProps }) {
  const selected = useStudio(s => s.selected === o.id), select = useStudio(s => s.select), beginDrag = useStudio(s => s.beginDrag), previewMove = useStudio(s => s.previewMove), endDrag = useStudio(s => s.endDrag)
  const ref = useRef<Group>(null!)
  const choose = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (props.measuring) props.onPoint({ point: [...o.position], objectId: o.id }); else { select(o.id); props.onObjectSelected?.() } }
  const model = <group ref={ref} position={o.position} rotation={o.rotation} userData={{ selectableObject: true }} onClick={choose}><ObjectModel o={o} selected={selected} />{props.display.labels && <Label p={[0, o.kind === 'speaker' ? o.size[1] + 0.18 : o.kind === 'sofa' ? o.size[1] + 0.12 : o.kind === 'listener' ? 0.25 : o.size[1] / 2 + 0.16, 0]}>{o.name}</Label>}{selected && props.display.measurements && <Label p={[0, -0.18, 0]}>{o.size.map(n => distanceLabel(n, props.unit)).join(' × ')}</Label>}</group>
  const canTransform = o.kind !== 'listener' && !(o.kind === 'panel' || o.kind === 'bass') || o.mount === 'free'
  return selected && canTransform && !o.parentSofaId && !o.placed && !props.measuring ? <>{model}<TransformControls object={ref} mode={props.mode} translationSnap={props.snap || null} rotationSnap={props.snap ? Math.PI / 12 : null} onMouseDown={beginDrag} onObjectChange={() => { if (ref.current && useStudio.getState().dragStart) previewMove(o.id, ref.current.position.toArray() as Vec3, [ref.current.rotation.x, ref.current.rotation.y, ref.current.rotation.z]) }} onMouseUp={endDrag} /></> : model
}
function Camera({ view, revision }: { view: string; revision: number }) {
  const r = useStudio(s => s.design.room), controls = useRef<OrbitType>(null)
  useEffect(() => { if (!controls.current) return; const c = controls.current, center: Vec3 = [r.width / 2, r.height / 2, r.length / 2], span = Math.max(r.width, r.length, r.height) * 1.65; const offsets: Record<string, Vec3> = { Perspective: [span * 0.8, span * 0.65, span], Front: [0, 0, -span], Rear: [0, 0, span], Left: [-span, 0, 0], Right: [span, 0, 0], Top: [0, span, 0.001], Side: [span, 0, 0] }; c.object.position.set(...add(center, offsets[view] || offsets.Perspective)); c.target.set(...center); c.update() }, [view, revision, r.width, r.length, r.height])
  return <OrbitControls ref={controls} makeDefault minDistance={0.5} maxDistance={100} />
}
function World(props: SceneProps) {
  const d = useStudio(s => s.design), selected = useStudio(s => s.selected), select = useStudio(s => s.select)
  const r = d.room
  const resolve = (a: Anchor) => d.objects.find(o => o.id === a.objectId)?.position || a.point
  return <><color attach="background" args={[props.theme === 'light' ? '#e8efec' : '#151c21']} /><ambientLight intensity={1.6} /><directionalLight position={[3, 10, 4]} intensity={2.8} castShadow shadow-mapSize={[2048, 2048]} /><Camera view={props.view} revision={props.cameraRevision} />
    {roomSurfaces(r).map(s => <mesh key={s.id} position={s.center} rotation={s.id === 'floor' || s.id === 'ceiling' ? [-Math.PI / 2, 0, 0] : s.id === 'left' || s.id === 'right' ? [0, Math.PI / 2, 0] : [0, 0, 0]} onClick={e => { if (props.display.transparent && e.intersections.some(hit => { let node = hit.object; while (node) { if (node.userData.selectableObject || (!props.measuring && node.userData.isRay)) return true; if (!node.parent) break; node = node.parent } return false })) return; e.stopPropagation(); if (props.measuring) props.onPoint({ point: e.point.toArray() as Vec3 }); else select(s.id) }} receiveShadow><planeGeometry args={[s.halfU * 2, s.halfV * 2]} /><meshStandardMaterial color={selected === s.id ? '#739a91' : s.id === 'floor' ? '#807663' : '#b1b7ae'} side={DoubleSide} transparent={props.display.transparent} opacity={props.display.transparent ? s.id === 'floor' ? 0.48 : 0.09 : 1} depthWrite={!props.display.transparent} roughness={0.88} /><Edges color={selected === s.id ? '#b8ffe0' : '#64746b'} /></mesh>)}
    {props.display.grid && <Grid position={[r.width / 2, -0.008, r.length / 2]} args={[r.width + 4, r.length + 4]} cellSize={0.3048} cellThickness={0.45} cellColor="#39484a" sectionSize={1.524} sectionThickness={0.7} sectionColor="#506463" fadeDistance={30} />}
    {props.display.axes && <group position={[-0.4, 0.02, -0.4]}><axesHelper args={[0.8]} /><Label p={[0.9, 0, 0]}>X</Label><Label p={[0, 0.9, 0]}>Y</Label><Label p={[0, 0, 0.9]}>Z</Label></group>}
    {d.objects.filter(o => o.visible && (!(o.kind === 'panel' || o.kind === 'bass') || props.display[o.kind])).map(o => <EditableObject key={o.id} o={o} props={props} />)}
    <RayMotion paths={props.paths}/><group key={`ray-layer-${props.paths.map(path => path.id).join('|')}`}>
    {props.paths.flatMap(path => path.points.slice(0, -1).map((point, i) => <Line key={`${path.id}:${i}`} userData={{ isRay: true }} dashed={path.order === 2} dashSize={0.12} gapSize={0.08} points={[point, path.points[i + 1]]} color={rayColor(path, i, props.theme)} transparent depthTest={!props.display.transparent} renderOrder={10} opacity={rayOpacity(path, i)} lineWidth={props.selectedRay === path.id ? 4 : path.surfaces[0] === 'Direct / incident' ? 2.8 : path.order === 1 ? 2.2 : 1.3} onClick={e => { if (!props.measuring) { e.stopPropagation(); props.onRay(path.id) } }} />))}
    </group>
    {props.display.measurements && <>{props.display.dimensions && <><Measure a={[0, 0.03, r.length + 0.4]} b={[r.width, 0.03, r.length + 0.4]} unit={props.unit} /><Measure a={[r.width + 0.4, 0.03, 0]} b={[r.width + 0.4, 0.03, r.length]} unit={props.unit} /><Measure a={[-0.3, 0, 0]} b={[-0.3, r.height, 0]} unit={props.unit} /></>}{props.display.wallMeasures && d.objects.filter(o => o.kind === 'speaker' || o.id === selected).map(o => <group key={o.id}><Measure a={o.position} b={[o.id === 'speaker-right' ? r.width : 0, o.position[1], o.position[2]]} unit={props.unit} /><Measure a={o.position} b={[o.position[0], o.position[1], 0]} unit={props.unit} /><Measure a={o.position} b={[o.position[0], 0, o.position[2]]} unit={props.unit} /></group>)}{props.display.custom && d.measurements.map(m => <Measure key={m.id} a={resolve(m.a)} b={resolve(m.b)} unit={props.unit} color="#e3bd7b" />)}</>}
  </>
}
class SceneBoundary extends Component<{ children: ReactNode }, { error: boolean }> { state = { error: false }; static getDerivedStateFromError() { return { error: true } } render() { return this.state.error ? <div className="webgl-fallback"><h2>3D preview unavailable</h2><p>Enable WebGL or try a browser with hardware acceleration. Your design is safe; all numeric editors and exports still work.</p><button onClick={() => this.setState({ error: false })}>Retry preview</button></div> : this.props.children } }
export default function Scene(props: SceneProps) { return <SceneBoundary><Canvas camera={{ position: [11, 9, 13], fov: 42, near: 0.05, far: 200 }} shadows dpr={[1, 1.75]} gl={{ antialias: true }} fallback={<div className="webgl-fallback">WebGL is unavailable. Use the left panel to edit and export your design.</div>}><Suspense fallback={null}><World {...props} /></Suspense></Canvas></SceneBoundary> }
