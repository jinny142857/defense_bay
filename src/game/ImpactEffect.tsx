import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, Vector3 } from 'three'
import type { Mesh, MeshBasicMaterial, PointLight } from 'three'

const IMPACT_LIFETIME_SEC = 1.2
// 섬광/충격파/파편은 전체 수명의 이 비율 안에서 빠르게 터지고 끝난다("펑").
const BURST_FRACTION = 0.3
const FLASH_FRACTION = 0.1
const SPARK_COUNT = 8
const SMOKE_COUNT = 7

function randomSparkDir() {
  const theta = Math.random() * Math.PI * 2
  const phi = Math.random() * Math.PI * 0.6 + Math.PI * 0.1
  return new Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi) * 0.6 + 0.2, Math.sin(phi) * Math.sin(theta))
}

function randomSmokeOffset() {
  return new Vector3((Math.random() - 0.5) * 0.9, Math.random() * 0.3, (Math.random() - 0.5) * 0.9)
}

// 명중 시 "맞았다"는 걸 확실히 보여주는 탄착 이펙트: 초반에 하얗게 번쩍하는 섬광 + 2단 충격파 링 +
// 사방으로 튀는 파편 스파크로 "펑" 터지고, 그 자리에 밝은 회백색 연기 뭉치가 뭉게뭉게 부풀어 오르며
// 눈에 띄게 남았다가 서서히 사라진다 — 포탄이 맞았을 때의 폭연처럼 멀리서도 또렷이 보여야 한다
// (링/섬광만으로는 반짝임 수준이라는 피드백, 참고 레퍼런스의 또렷한 포연 덩어리를 기준으로 삼는다).
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
      flashRef.current.scale.setScalar(0.7 + flashT * 3.2)
    }
    if (coreRef.current) {
      const mat = coreRef.current.material as MeshBasicMaterial
      mat.opacity = burstFade
      coreRef.current.scale.setScalar(0.7 + burstT * 2.2)
    }
    if (ringRef.current) {
      const mat = ringRef.current.material as MeshBasicMaterial
      mat.opacity = burstFade * 0.9
      ringRef.current.scale.setScalar(0.4 + burstT * 7)
    }
    if (outerRingRef.current) {
      const mat = outerRingRef.current.material as MeshBasicMaterial
      mat.opacity = burstFade * 0.5
      outerRingRef.current.scale.setScalar(0.6 + burstT * 10)
    }
    sparkRefs.current.forEach((spark, i) => {
      if (!spark) return
      const dir = sparkDirs[i]
      const dist = burstT * 2.6 * (0.7 + (i % 3) * 0.15)
      spark.position.set(dir.x * dist, dir.y * dist, dir.z * dist)
      const mat = spark.material as MeshBasicMaterial
      mat.opacity = burstFade
      spark.scale.setScalar(0.03 + burstFade * 0.16)
    })
    // 연기: 포탄이 터진 자리에 뭉게뭉게 부풀어 오르는 포연 덩어리 — 밝은 회백색이라 어두운 바다/
    // 몹/보스를 배경으로도 또렷이 보이고, 전체 수명 내내 남아있다가 끝에서야 옅어진다.
    smokeRefs.current.forEach((smoke, i) => {
      if (!smoke) return
      const off = smokeOffsets[i]
      const bloom = Math.min(1, t / 0.4) // 처음 40% 동안 빠르게 부풀어 오른다
      smoke.position.set(off.x * (0.5 + t * 0.8), 0.2 + t * 1.6 + off.y, off.z * (0.5 + t * 0.8))
      const mat = smoke.material as MeshBasicMaterial
      mat.opacity = Math.max(0, fade * 0.85 * bloom)
      smoke.scale.setScalar(0.35 + bloom * 1.5 + t * 0.6)
    })
    if (lightRef.current) lightRef.current.intensity = 30 * burstFade * burstFade
    if (next >= IMPACT_LIFETIME_SEC) onDone()
  })

  return (
    <group position={position}>
      <pointLight ref={lightRef} color={color} intensity={30} distance={10} />
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
          <meshBasicMaterial color="#cfc9bd" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
