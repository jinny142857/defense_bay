import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import type { Mesh, PlaneGeometry, ShaderMaterial } from 'three'
import { createSea, createSky } from './SeaWater.js'

type SeaMesh = Mesh<PlaneGeometry, ShaderMaterial>

// 사용자 제공 바다/하늘 셰이더(SeaEnvironment_GameAssets/README_for_ClaudeCode.md 가이드).
// Gerstner 파도 — getWaveHeight()가 몹 잠김 계산과 동일한 높이를 CPU에서 재현한다 (Mob.tsx 참고).
export function Sea({ onPointerDown }: { onPointerDown?: (e: ThreeEvent<PointerEvent>) => void }) {
  const sea = useMemo(() => createSea() as SeaMesh, [])
  const sky = useMemo(() => createSky(), [])

  useFrame(({ clock }) => {
    sea.material.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <>
      <primitive object={sky} />
      <primitive object={sea} onPointerDown={onPointerDown} />
    </>
  )
}
