import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { Group } from 'three'

// M1 임시 도형: 실제 탱크 포탑 모델(PRD 7.4)은 이후 마일스톤에서 GLB로 교체한다.
export function Turret() {
  const pivot = useRef<Group>(null)
  const { pointer } = useThree()

  useFrame(() => {
    if (!pivot.current) return
    const targetYaw = pointer.x * 0.6
    const targetPitch = pointer.y * 0.3
    pivot.current.rotation.y += (targetYaw - pivot.current.rotation.y) * 0.15
    pivot.current.rotation.x += (targetPitch - pivot.current.rotation.x) * 0.15
  })

  return (
    <group position={[0, 0.2, -4]}>
      <mesh position={[0, -0.3, 0]} castShadow>
        <boxGeometry args={[1.6, 0.6, 1.6]} />
        <meshStandardMaterial color="#8a3a1a" />
      </mesh>
      <group ref={pivot} position={[0, 0.1, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.35, 0.5, 4, 8]} />
          <meshStandardMaterial color="#c9481a" />
        </mesh>
        <mesh position={[0, 0, -1.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 1.8, 8]} />
          <meshStandardMaterial color="#2a2a28" />
        </mesh>
      </group>
    </group>
  )
}
