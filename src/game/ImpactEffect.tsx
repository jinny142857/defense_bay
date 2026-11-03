import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, Vector3 } from 'three'
import type { Mesh, MeshBasicMaterial, PointLight } from 'three'

const IMPACT_LIFETIME_SEC = 0.5
const FLASH_FRACTION = 0.15 // 전체 수명 중 초반 섬광이 번쩍하는 비율
const SPARK_COUNT = 7

function randomSparkDir() {
  const theta = Math.random() * Math.PI * 2
  const phi = Math.random() * Math.PI * 0.6 + Math.PI * 0.1
  return new Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi) * 0.6 + 0.2, Math.sin(phi) * Math.sin(theta))
}

// 명중 시 "맞았다"는 걸 확실히 보여주는 탄착 이펙트. 초반에 하얗게 번쩍하는 섬광 + 2단 충격파 링 +
// 사방으로 튀는 파편 스파크로 "펑" 터지는 느낌을 낸다(기존 섬광+링만으로는 너무 미미하다는 피드백).
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
  const flashRef = useRef<Mesh>(null)
  const coreRef = useRef<Mesh>(null)
  const ringRef = useRef<Mesh>(null)
  const outerRingRef = useRef<Mesh>(null)
  const lightRef = useRef<PointLight>(null)
  const sparkRefs = useRef<(Mesh | null)[]>([])
  const sparkDirs = useMemo(() => Array.from({ length: SPARK_COUNT }, randomSparkDir), [])

  useFrame((_, delta) => {
    const next = age + delta
    setAge(next)
    const t = Math.min(1, next / IMPACT_LIFETIME_SEC)
    const fade = 1 - t

    if (flashRef.current) {
      const flashT = Math.min(1, next / (IMPACT_LIFETIME_SEC * FLASH_FRACTION))
      const mat = flashRef.current.material as MeshBasicMaterial
      mat.opacity = Math.max(0, 1 - flashT)
      flashRef.current.scale.setScalar(0.5 + flashT * 2.2)
    }
    if (coreRef.current) {
      const mat = coreRef.current.material as MeshBasicMaterial
      mat.opacity = fade
      coreRef.current.scale.setScalar(0.5 + t * 1.4)
    }
    if (ringRef.current) {
      const mat = ringRef.current.material as MeshBasicMaterial
      mat.opacity = fade * 0.9
      ringRef.current.scale.setScalar(0.3 + t * 5)
    }
    if (outerRingRef.current) {
      const mat = outerRingRef.current.material as MeshBasicMaterial
      mat.opacity = fade * 0.5
      outerRingRef.current.scale.setScalar(0.5 + t * 7.5)
    }
    sparkRefs.current.forEach((spark, i) => {
      if (!spark) return
      const dir = sparkDirs[i]
      const dist = t * 1.9 * (0.7 + (i % 3) * 0.15)
      spark.position.set(dir.x * dist, dir.y * dist, dir.z * dist)
      const mat = spark.material as MeshBasicMaterial
      mat.opacity = fade
      spark.scale.setScalar(0.02 + fade * 0.12)
    })
    if (lightRef.current) lightRef.current.intensity = 24 * fade * fade
    if (next >= IMPACT_LIFETIME_SEC) onDone()
  })

  return (
    <group position={position}>
      <pointLight ref={lightRef} color={color} intensity={24} distance={9} />
      <mesh ref={flashRef}>
        <sphereGeometry args={[0.3, 10, 10]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={1} />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.3, 10, 10]} />
        <meshBasicMaterial color="#fff6d8" transparent opacity={1} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.52, 24]} />
        <meshBasicMaterial color={color} transparent opacity={1} side={DoubleSide} />
      </mesh>
      <mesh ref={outerRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.52, 24]} />
        <meshBasicMaterial color="#fff6d8" transparent opacity={0.6} side={DoubleSide} />
      </mesh>
      {sparkDirs.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            sparkRefs.current[i] = el
          }}
        >
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color={color} transparent opacity={1} />
        </mesh>
      ))}
    </group>
  )
}
