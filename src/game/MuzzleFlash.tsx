import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending } from 'three'
import type { PointLight, Sprite, SpriteMaterial } from 'three'
import { emberTexture, flashTexture } from './vfxTextures'

const FLASH_LIFETIME_SEC = 0.14
const EMBER_COUNT = 5

function randomEmberDir() {
  const angle = Math.random() * Math.PI * 2
  const r = 0.15 + Math.random() * 0.25
  return [Math.cos(angle) * r, Math.sin(angle) * r * 0.6, 0] as [number, number, number]
}

// 포구 화염: 평평한 구체 대신 그라디언트 텍스처를 입힌 스프라이트(항상 카메라를 향함)로 번쩍이는
// 섬광을 표현하고, 그 자리에서 튀는 불씨 몇 점을 더해 "총구에서 뭔가 터져 나온다"는 느낌을 준다.
export function MuzzleFlash({
  position,
  onDone,
}: {
  position: [number, number, number]
  onDone: () => void
}) {
  const [age, setAge] = useState(0)
  const flashRef = useRef<Sprite>(null)
  const emberRefs = useRef<(Sprite | null)[]>([])
  const lightRef = useRef<PointLight>(null)
  const emberDirs = useRef(Array.from({ length: EMBER_COUNT }, randomEmberDir))

  useFrame((_, delta) => {
    const next = age + delta
    setAge(next)
    const t = Math.max(0, 1 - next / FLASH_LIFETIME_SEC)

    if (flashRef.current) {
      const mat = flashRef.current.material as SpriteMaterial
      mat.opacity = t
      const scale = 0.5 + 1.3 * (1 - t) * t * 4 // 빠르게 커졌다 줄어드는 펑 느낌
      flashRef.current.scale.setScalar(0.6 + scale)
    }
    emberRefs.current.forEach((ember, i) => {
      if (!ember) return
      const dir = emberDirs.current[i]
      const spread = (1 - t) * 1.4
      ember.position.set(dir[0] * spread, dir[1] * spread, dir[2] * spread)
      const mat = ember.material as SpriteMaterial
      mat.opacity = t
      ember.scale.setScalar(0.06 + t * 0.12)
    })
    if (lightRef.current) lightRef.current.intensity = 8 * t
    if (next >= FLASH_LIFETIME_SEC) onDone()
  })

  return (
    <group position={position}>
      <pointLight ref={lightRef} color="#ffb347" intensity={8} distance={5} />
      <sprite ref={flashRef}>
        <spriteMaterial
          map={flashTexture}
          transparent
          opacity={1}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      {emberDirs.current.map((_, i) => (
        <sprite
          key={`ember-${i}`}
          ref={(el) => {
            emberRefs.current[i] = el
          }}
        >
          <spriteMaterial
            map={emberTexture}
            transparent
            opacity={1}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  )
}
