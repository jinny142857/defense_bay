import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector2, Vector3 } from 'three'
import type { Sprite } from 'three'
import {
  FLIPBOOK_DURATION_SEC,
  FLIPBOOK_FPS,
  WATERBURST_SHEET_URL,
  loadFlipbookSheet,
  setFlipbookFrame,
} from './flipbookVfx'

// 공중 포격(VFX_SPEC.md): 바다 착탄 물기둥. 칸 아래에서 10% 지점이 수면.
const BASE_SCALE = 7.4
const ANCHOR_Y = 0.1
const REFERENCE_DISTANCE = 15
const SPRITE_CENTER = new Vector2(0.5, ANCHOR_Y)

export function WaterBurstEffect({
  position,
  onDone,
}: {
  position: [number, number, number]
  onDone: () => void
}) {
  const { camera } = useThree()
  const distanceBoost = useMemo(
    () => Math.max(1, new Vector3(...position).distanceTo(camera.position) / REFERENCE_DISTANCE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [age, setAge] = useState(0)
  const spriteRef = useRef<Sprite>(null)
  const tex = useMemo(() => loadFlipbookSheet(WATERBURST_SHEET_URL).clone(), [])

  useFrame((_, delta) => {
    const next = age + delta
    setAge(next)
    setFlipbookFrame(tex, next * FLIPBOOK_FPS)
    tex.needsUpdate = true
    spriteRef.current?.scale.setScalar(BASE_SCALE * distanceBoost)
    if (next >= FLIPBOOK_DURATION_SEC) onDone()
  })

  return (
    <group position={position}>
      <sprite ref={spriteRef} center={SPRITE_CENTER}>
        <spriteMaterial map={tex} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}
