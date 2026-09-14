import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import { BackSide, FrontSide, DoubleSide, ShaderMaterial, Vector3 } from 'three';
import type { Room, Vec3 } from '../domain/model';
import { roomSurfaces } from '../domain/acoustics';
import type { RoomMode } from '../domain/acoustics';

export type ModeView = { selected?: RoomMode; animate: boolean; nodes: boolean };
const vertexShader = `varying vec3 roomPoint;
void main() { vec4 world = modelMatrix * vec4(position, 1.0); roomPoint = world.xyz; gl_Position = projectionMatrix * viewMatrix * world; }`;
const fragmentShader = `varying vec3 roomPoint;
uniform vec3 dimensions; uniform vec3 orders; uniform float phase;
void main() {
  vec3 wave = cos(3.14159265359 * orders * roomPoint / dimensions);
  float pressure = wave.x * wave.y * wave.z * phase;
  vec3 neutral = vec3(0.64, 0.67, 0.70);
  vec3 pole = pressure >= 0.0 ? vec3(0.94, 0.25, 0.27) : vec3(0.16, 0.40, 0.94);
  gl_FragColor = vec4(mix(neutral, pole, abs(pressure)), 0.35);
}`;
function PressureSurface({ room, view, surface }: { room: Room; view: ModeView; surface: ReturnType<typeof roomSurfaces>[number] }) {
  const material = useRef<ShaderMaterial>(null);
  const [l, w, h] = view.selected?.orders ?? [0, 0, 0];
  const uniforms = useMemo(() => ({ dimensions: { value: new Vector3(room.width, room.height, room.length) }, orders: { value: new Vector3(w, h, l) }, phase: { value: view.selected ? 1 : 0 } }), [room.width, room.height, room.length, l, w, h, view.selected]);
  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.phase.value = !view.selected ? 0 : view.animate ? Math.cos(clock.elapsedTime * 2) : 1;
  });
  const horizontal = surface.id === 'floor' || surface.id === 'ceiling';
  const lateral = surface.id === 'left' || surface.id === 'right';
  // Only inside faces render: the nearest walls and ceiling cut away naturally
  // as the camera orbits, exposing the selected mode on the far boundaries.
  return <mesh position={surface.center} rotation={horizontal ? [-Math.PI / 2, 0, 0] : lateral ? [0, Math.PI / 2, 0] : [0, 0, 0]}>
    <planeGeometry args={[surface.halfU * 2, surface.halfV * 2]} />
    <shaderMaterial transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} ref={material} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} side={['ceiling', 'right', 'rear'].includes(surface.id) ? BackSide : FrontSide} />
  </mesh>;
}
export default function ModeField({ room, view }: { room: Room; view: ModeView }) {
  const [l, w, h] = view.selected?.orders ?? [0, 0, 0];
  const planes: { position: Vec3; rotation: Vec3; size: [number, number] }[] = [];
  if (view.nodes) {
    for (let i = 0; i < l; i++) planes.push({ position: [room.width / 2, room.height / 2, room.length * (i + 0.5) / l], rotation: [0, 0, 0], size: [room.width, room.height] });
    for (let i = 0; i < w; i++) planes.push({ position: [room.width * (i + 0.5) / w, room.height / 2, room.length / 2], rotation: [0, Math.PI / 2, 0], size: [room.length, room.height] });
    for (let i = 0; i < h; i++) planes.push({ position: [room.width / 2, room.height * (i + 0.5) / h, room.length / 2], rotation: [-Math.PI / 2, 0, 0], size: [room.width, room.length] });
  }
  return <group>
    {view.selected && roomSurfaces(room).map(surface => <PressureSurface key={surface.id} room={room} view={view} surface={surface} />)}
    {planes.map((plane, i) => <mesh key={i} position={plane.position} rotation={plane.rotation}>
      <planeGeometry args={plane.size} /><meshBasicMaterial color="#c9f6e5" transparent opacity={0.13} depthWrite={false} side={DoubleSide} /><Edges color="#a4d4c3" />
    </mesh>)}
  </group>;
}
