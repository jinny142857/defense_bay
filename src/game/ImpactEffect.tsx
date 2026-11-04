import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, Vector3 } from 'three'
import type { PointLight, Sprite, SpriteMaterial } from 'three'
import { emberTexture, fireTexture, flashTexture, smokeTexture } from './vfxTextures'

const IMPACT_LIFETIME_SEC = 1.2
// 섬광/화염/파편은 전체 수명의 이 비율 안에서 빠르게 터지고 끝난다("펑").
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

// 명중 시 "맞았다"는 걸 확실히 보여주는 탄착 이펙트. 평평한 구체/링 지오메트리는 입체감 없는
// "색칠된 공"으로 보여서, 그라디언트 텍스처를 입힌 스프라이트(항상 카메라를 향함)로 전부 교체했다:
// 하얗게 번쩍하는 섬광 + 주황빛 화염 코어 + 사방으로 튀는 불씨 파편으로 "펑" 터지고, 그 자리에
// 밝은 회백색 연기 뭉치가(일반 알파 블렌딩이라 실제 연기처럼 불투명하게) 뭉게뭉게 부풀어 오르며
// 눈에 띄게 남았다가 서서히 사라진다.
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
  const flashRef = useRef<Sprite>(null)
  const fireRef = useRef<Sprite>(null)
  const lightRef = useRef<PointLight>(null)
  const sparkRefs = useRef<(Sprite | null)[]>([])
  const smokeRefs = useRef<(Sprite | null)[]>([])
  const sparkDirs = useMemo(() => Array.from({ length: SPARK_COUNT }, randomSparkDir), [])
  const smokeOffsets = useMemo(() => Array.from({ length: SMOKE_COUNT }, randomSmokeOffset), [])
  const fireColor = useMemo(() => new Color(color), [color])

  useFrame((_, delta) => {
    const next = age + delta
    setAge(next)
    const t = Math.min(1, next / IMPACT_LIFETIME_SEC)
    const fade = 1 - t
    const burstT = Math.min(1, next / (IMPACT_LIFETIME_SEC * BURST_FRACTION))
    const burstFade = 1 - burstT

    if (flashRef.current) {
      const flashT = Math.min(1, next / (IMPACT_LIFETIME_SEC * FLASH_FRACTION))
      const mat = flashRef.current.material as SpriteMaterial
      mat.opacity = Math.max(0, 1 - flashT)
      flashRef.current.scale.setScalar(1.0 + flashT * 3.6)
    }
    if (fireRef.current) {
      const mat = fireRef.current.material as SpriteMaterial
      mat.opacity = burstFade
      fireRef.current.scale.setScalar(0.9 + burstT * 3.4)
    }
    sparkRefs.current.forEach((spark, i) => {
      if (!spark) return
      const dir = sparkDirs[i]
      const dist = burstT * 2.6 * (0.7 + (i % 3) * 0.15)
      spark.position.set(dir.x * dist, dir.y * dist, dir.z * dist)
      const mat = spark.material as SpriteMaterial
      mat.opacity = burstFade
      spark.scale.setScalar(0.1 + burstFade * 0.35)
    })
    // 연기: 포탄이 터진 자리에 뭉게뭉게 부풀어 오르는 포연 덩어리 — 밝은 회백색이라 어두운 바다/
    // 몹/보스를 배경으로도 또렷이 보이고, 전체 수명 내내 남아있다가 끝에서야 옅어진다.
    smokeRefs.current.forEach((smoke, i) => {
      if (!smoke) return
      const off = smokeOffsets[i]
      const bloom = Math.min(1, t / 0.4) // 처음 40% 동안 빠르게 부풀어 오른다
      smoke.position.set(off.x * (0.5 + t * 0.8), 0.2 + t * 1.6 + off.y, off.z * (0.5 + t * 0.8))
      const mat = smoke.material as SpriteMaterial
      mat.opacity = Math.max(0, fade * 0.85 * bloom)
      smoke.scale.setScalar(0.7 + bloom * 3.0 + t * 1.2)
    })
    if (lightRef.current) lightRef.current.intensity = 35 * burstFade * burstFade
    if (next >= IMPACT_LIFETIME_SEC) onDone()
  })

  return (
    <group position={position}>
      <pointLight ref={lightRef} color={color} intensity={35} distance={10} />
      <sprite ref={flashRef}>
        <spriteMaterial map={flashTexture} transparent opacity={1} blending={AdditiveBlending} depthWrite={false} />
      </sprite>
      <sprite ref={fireRef}>
        <spriteMaterial
          map={fireTexture}
          color={fireColor}
          transparent
          opacity={1}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      {sparkDirs.map((_, i) => (
        <sprite
          key={`spark-${i}`}
          ref={(el) => {
            sparkRefs.current[i] = el
          }}
        >
          <spriteMaterial
            map={emberTexture}
            color={fireColor}
            transparent
            opacity={1}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      ))}
      {smokeOffsets.map((_, i) => (
        <sprite
          key={`smoke-${i}`}
          ref={(el) => {
            smokeRefs.current[i] = el
          }}
        >
          <spriteMaterial map={smokeTexture} transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
    </group>
  )
}
