import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, Vector2, Vector3 } from 'three'
import type { PointLight, Sprite } from 'three'
import {
  EXPLOSION_SHEET_URL,
  FLIPBOOK_DURATION_SEC,
  FLIPBOOK_FPS,
  SPARKS_SHEET_URL,
  loadFlipbookSheet,
  setFlipbookFrame,
} from './flipbookVfx'

// 블렌더로 구운 실제 시뮬레이션 플립북(VFX_SPEC.md)으로 교체했다 — 흰 코어 -> 주황/빨강 화염 ->
// 회갈색 연기로 자연스럽게 번지는 36프레임 애니메이션 + 그 위에 겹치는 파편 스프라이트.
const BASE_SCALE = 4.6 // VFX_SPEC.md 기준 칸 한 변의 실제 크기(m)
const ANCHOR_Y = 0.23 // 칸 아래에서 23% 지점이 폭발 중심
// 몹은 카메라에서 최대 260m까지 떨어져서 스폰되는데, 이펙트 크기가 고정이면 원근 때문에 멀수록
// 점점 작아지다가 사실상 안 보이게 된다 — 카메라 거리에 비례해 크기를 키운다.
const REFERENCE_DISTANCE = 15
const BURST_LIGHT_FRACTION = 0.3
const SPRITE_CENTER = new Vector2(0.5, ANCHOR_Y)

export function ImpactEffect({
  position,
  color = '#ff5a36',
  scale = 1,
  onDone,
}: {
  position: [number, number, number]
  color?: string
  // 공중 포격의 수면 폭발 같은 작은 보조 이펙트는 축소해서 띄운다(VFX_SPEC.md 권장 0.55배).
  scale?: number
  onDone: () => void
}) {
  const { camera } = useThree()
  const distanceBoost = useMemo(
    () => Math.max(1, new Vector3(...position).distanceTo(camera.position) / REFERENCE_DISTANCE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [age, setAge] = useState(0)
  const explosionRef = useRef<Sprite>(null)
  const sparksRef = useRef<Sprite>(null)
  const lightRef = useRef<PointLight>(null)

  const explosionTex = useMemo(() => loadFlipbookSheet(EXPLOSION_SHEET_URL).clone(), [])
  const sparksTex = useMemo(() => loadFlipbookSheet(SPARKS_SHEET_URL).clone(), [])

  useFrame((_, delta) => {
    const next = age + delta
    setAge(next)
    const frame = next * FLIPBOOK_FPS
    setFlipbookFrame(explosionTex, frame)
    setFlipbookFrame(sparksTex, frame)
    explosionTex.needsUpdate = true
    sparksTex.needsUpdate = true

    const finalScale = BASE_SCALE * scale * distanceBoost
    explosionRef.current?.scale.setScalar(finalScale)
    sparksRef.current?.scale.setScalar(finalScale)

    if (lightRef.current) {
      const burstT = Math.min(1, next / (FLIPBOOK_DURATION_SEC * BURST_LIGHT_FRACTION))
      const burstFade = 1 - burstT
      lightRef.current.intensity = 35 * burstFade * burstFade
      lightRef.current.distance = 10 * distanceBoost
    }

    if (next >= FLIPBOOK_DURATION_SEC) onDone()
  })

  return (
    <group position={position}>
      <pointLight ref={lightRef} color={color} intensity={35} distance={10} />
      <sprite ref={explosionRef} center={SPRITE_CENTER} renderOrder={998}>
        <spriteMaterial map={explosionTex} transparent depthWrite={false} />
      </sprite>
      <sprite ref={sparksRef} center={SPRITE_CENTER} renderOrder={999}>
        <spriteMaterial map={sparksTex} transparent depthWrite={false} blending={AdditiveBlending} />
      </sprite>
    </group>
  )
}

