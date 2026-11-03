import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide } from 'three'
import type { Mesh, MeshBasicMaterial, PointLight } from 'three'

const IMPACT_LIFETIME_SEC = 0.35

// 명중 시 "맞았다"는 걸 분명히 보여주기 위한 탄착 이펙트(섬광+확산 링). 사격 궤적(Projectile)만으로는
// 비·안개 속에서 명중 여부가 잘 안 보인다는 피드백에 따라 추가.
export function ImpactEffect({
  position,
  color = '#ff5a36',
  onDone,
}: {
  position: [number, number, number]
  color?: string
  onDone: () => void
}) {
  const [age, setAge] = useState(0)
  const coreRef = useRef<Mesh>(null)
  const ringRef = useRef<Mesh>(null)
  const lightRef = useRef<PointLight>(null)

  useFrame((_, delta) => {
    const next = age + delta
    setAge(next)
    const t = Math.min(1, next / IMPACT_LIFETIME_SEC)
    const fade = 1 - t
    if (coreRef.current) {
      const mat = coreRef.current.material as MeshBasicMaterial
      mat.opacity = fade
      coreRef.current.scale.setScalar(0.6 + fade * 0.6)
    }
    if (ringRef.current) {
      const mat = ringRef.current.material as MeshBasicMaterial
      mat.opacity = fade * 0.85
      ringRef.current.scale.setScalar(0.4 + t * 2.4)
    }
    if (lightRef.current) lightRef.current.intensity = 10 * fade
    if (next >= IMPACT_LIFETIME_SEC) onDone()
  })

  return (
    <group position={position}>
      <pointLight ref={lightRef} color={color} intensity={10} distance={6} />
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.25, 10, 10]} />
        <meshBasicMaterial color="#fff6d8" transparent opacity={1} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.46, 24]} />
        <meshBasicMaterial color={color} transparent opacity={1} side={DoubleSide} />
      </mesh>
    </group>
  )
}
