import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, MeshBasicMaterial, PointLight } from 'three'

const FLASH_LIFETIME_SEC = 0.08

export function MuzzleFlash({
  position,
  onDone,
}: {
  position: [number, number, number]
  onDone: () => void
}) {
  const [age, setAge] = useState(0)
  const meshRef = useRef<Mesh>(null)
  const lightRef = useRef<PointLight>(null)

  useFrame((_, delta) => {
    const next = age + delta
    setAge(next)
    const t = Math.max(0, 1 - next / FLASH_LIFETIME_SEC)
    if (meshRef.current) {
      const mat = meshRef.current.material as MeshBasicMaterial
      mat.opacity = t
      meshRef.current.scale.setScalar(0.4 + 0.6 * t)
    }
    if (lightRef.current) lightRef.current.intensity = 6 * t
    if (next >= FLASH_LIFETIME_SEC) onDone()
  })

  return (
    <group position={position}>
      <pointLight ref={lightRef} color="#ffb347" intensity={6} distance={4} />
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshBasicMaterial color="#fff3c4" transparent opacity={1} />
      </mesh>
    </group>
  )
}
