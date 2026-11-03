import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, Vector3 } from 'three'
import type { Mesh, MeshBasicMaterial, PointLight } from 'three'

const IMPACT_LIFETIME_SEC = 1.0
// 섬광/충격파/파편은 전체 수명의 이 비율 안에서 빠르게 터지고 끝난다("펑").
const BURST_FRACTION = 0.3
const FLASH_FRACTION = 0.1
const SPARK_COUNT = 8
const SMOKE_COUNT = 4

function randomSparkDir() {
  const theta = Math.random() * Math.PI * 2
  const phi = Math.random() * Math.PI * 0.6 + Math.PI * 0.1
  return new Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi) * 0.6 + 0.2, Math.sin(phi) * Math.sin(theta))
}

function randomSmokeOffset() {
  return new Vector3((Math.random() - 0.5) * 0.5, Math.random() * 0.2, (Math.random() - 0.5) * 0.5)
}

// 명중 시 "맞았다"는 걸 확실히 보여주는 탄착 이펙트: 초반에 하얗게 번쩍하는 섬광 + 2단 충격파 링 +
// 사방으로 튀는 파편 스파크로 "펑" 터지고, 그 뒤로 짙은 연기 뭉치가 피어오르며 천천히 사라진다
// (섬광/링만으로는 너무 미미하고, 연기가 없어 "폭발"이라기보단 반짝임처럼 보인다는 피드백에 따라 보강).
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
  const smokeRefs = useRef<(Mesh | null)[]>([])
  const sparkDirs = useMemo(() => Array.from({ length: SPARK_COUNT }, randomSparkDir), [])
  const smokeOffsets = useMemo(() => Array.from({ length: SMOKE_COUNT }, randomSmokeOffset), [])

  useFrame((_, delta) => {
    const next = age + delta
    setAge(next)
    const t = Math.min(1, next / IMPACT_LIFETIME_SEC)
    const fade = 1 - t
    const burstT = Math.min(1, next / (IMPACT_LIFETIME_SEC * BURST_FRACTION))
    const burstFade = 1 - burstT

    if (flashRef.current) {
      const flashT = Math.min(1, next / (IMPACT_LIFETIME_SEC * FLASH_FRACTION))
      const mat = flashRef.current.material as MeshBasicMaterial
      mat.opacity = Math.max(0, 1 - flashT)
      flashRef.current.scale.setScalar(0.5 + flashT * 2.4)
    }
    if (coreRef.current) {
      const mat = coreRef.current.material as MeshBasicMaterial
      mat.opacity = burstFade
      coreRef.current.scale.setScalar(0.5 + burstT * 1.6)
    }
    if (ringRef.current) {
      const mat = ringRef.current.material as MeshBasicMaterial
      mat.opacity = burstFade * 0.9
      ringRef.current.scale.setScalar(0.3 + burstT * 5.5)
    }
    if (outerRingRef.current) {
      const mat = outerRingRef.current.material as MeshBasicMaterial
      mat.opacity = burstFade * 0.5
      outerRingRef.current.scale.setScalar(0.5 + burstT * 8)
    }
    sparkRefs.current.forEach((spark, i) => {
      if (!spark) return
      const dir = sparkDirs[i]
      const dist = burstT * 2.1 * (0.7 + (i % 3) * 0.15)
      spark.position.set(dir.x * dist, dir.y * dist, dir.z * dist)
      const mat = spark.material as MeshBasicMaterial
      mat.opacity = burstFade
      spark.scale.setScalar(0.02 + burstFade * 0.13)
    })
    // 연기: 전체 수명 내내 천천히 위로 피어오르며 커지다가 끝에 사라진다(폭발 섬광보다 오래 남는다).
    smokeRefs.current.forEach((smoke, i) => {
      if (!smoke) return
      const off = smokeOffsets[i]
      smoke.position.set(off.x * (1 + t), 0.15 + t * 2.2 + off.y, off.z * (1 + t))
      const mat = smoke.material as MeshBasicMaterial
      mat.opacity = Math.max(0, (fade - 0.05) * 0.55)
      smoke.scale.setScalar(0.25 + t * 0.9)
    })
    if (lightRef.current) lightRef.current.intensity = 26 * burstFade * burstFade
    if (next >= IMPACT_LIFETIME_SEC) onDone()
  })

  return (
    <group position={position}>
      <pointLight ref={lightRef} color={color} intensity={26} distance={9} />
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
          key={`spark-${i}`}
          ref={(el) => {
            sparkRefs.current[i] = el
          }}
        >
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color={color} transparent opacity={1} />
        </mesh>
      ))}
      {smokeOffsets.map((_, i) => (
        <mesh
          key={`smoke-${i}`}
          ref={(el) => {
            smokeRefs.current[i] = el
          }}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color="#2a2622" transparent opacity={0} />
        </mesh>
      ))}
    </group>
  )
}
