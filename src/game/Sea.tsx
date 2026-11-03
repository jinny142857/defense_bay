import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'
import type { PlaneGeometry as PlaneGeometryType, ShaderMaterial } from 'three'
import { createSea, createSky } from './SeaWater.js'
import { raycastTargets } from './raycastRegistry'

type SeaMesh = Mesh<PlaneGeometryType, ShaderMaterial>

// 사용자 제공 바다/하늘 셰이더(SeaEnvironment_GameAssets/README_for_ClaudeCode.md 가이드).
// Gerstner 파도 — getWaveHeight()가 몹 잠김 계산과 동일한 높이를 CPU에서 재현한다 (Mob.tsx 참고).
export function Sea({ onPointerDown }: { onPointerDown?: (e: ThreeEvent<PointerEvent>) => void }) {
  const sea = useMemo(() => createSea() as SeaMesh, [])
  const sky = useMemo(() => createSky(), [])
  // AimRay(Scene.tsx)가 "빗맞음" 조준 지점/거리를 구하려고 매 프레임 레이캐스트할 배경.
  // 실제 바다 메시는 파도 변위를 위해 400x400 분할(삼각형 32만 개)이라 매 프레임 쏘기엔 너무 무겁다
  // — 같은 자리에 겹친, 분할 없는 평면 1장(삼각형 2개)을 대신 등록해 레이캐스트 비용을 없앤다.
  const raycastProxy = useMemo(() => {
    const geometry = new PlaneGeometry(1600, 1600, 1, 1)
    geometry.rotateX(-Math.PI / 2)
    const material = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    const mesh = new Mesh(geometry, material)
    mesh.name = 'SeaRaycastProxy'
    return mesh
  }, [])

  useEffect(() => {
    raycastTargets.add(raycastProxy)
    return () => {
      raycastTargets.delete(raycastProxy)
    }
  }, [raycastProxy])

  useFrame(({ clock }) => {
    sea.material.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <>
      <primitive object={sky} />
      <primitive object={sea} onPointerDown={onPointerDown} />
      <primitive object={raycastProxy} />
    </>
  )
}
