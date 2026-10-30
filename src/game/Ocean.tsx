import type { ThreeEvent } from '@react-three/fiber'

// M1 임시 도형: 실제 물 셰이더(PRD 7.4)는 이후 마일스톤에서 교체한다.
export function Ocean({ onPointerDown }: { onPointerDown?: (e: ThreeEvent<PointerEvent>) => void }) {
  return (
    <mesh
      position={[0, -1, -40]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onPointerDown={onPointerDown}
    >
      <planeGeometry args={[300, 300]} />
      <meshStandardMaterial color="#1a4a63" roughness={0.6} metalness={0.1} />
    </mesh>
  )
}
