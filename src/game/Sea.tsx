import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { EquirectangularReflectionMapping, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, TextureLoader } from 'three'
import type { PlaneGeometry as PlaneGeometryType, ShaderMaterial } from 'three'
import { createSea, createSky } from './SeaWater.js'
import { raycastTargets } from './raycastRegistry'
import type { StageTheme } from '../config/stageThemes'

type SeaMesh = Mesh<PlaneGeometryType, ShaderMaterial>

// 사용자 제공 바다/하늘 셰이더(SeaEnvironment_GameAssets/README_for_ClaudeCode.md 가이드).
// Gerstner 파도 — getWaveHeight()가 몹 잠김 계산과 동일한 높이를 CPU에서 재현한다 (Mob.tsx 참고).
// 스테이지가 바뀌면 theme을 보고 바다 색/파도진폭/안개 없는 하늘 사진으로 색만 갈아탄다
// (StageThemes.js의 applyStageTheme 로직을 R3F 쪽에서 재현 — 메시를 새로 만들지 않고 유니폼만 갱신).
export function Sea({
  theme,
  onPointerDown,
}: {
  theme: StageTheme
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void
}) {
  const { scene } = useThree()
  // 큰 파고(Gerstner 변위)가 화면 전체와 몹/보급상자까지 위아래로 흔들어 멀미난다는 피드백 —
  // 변위는 거의 0으로 죽이고, 빛 반사/썬글린트/잔물결 음영(프래그먼트 셰이더의 ripple() 노이즈,
  // uWaveAmp와 무관하게 항상 동작)만 남긴다. 그래야 "반짝이는 잔잔한 바다"로 보인다.
  const sea = useMemo(() => createSea({ waveAmp: theme.sea.waveAmp, opacity: theme.sea.opacity }) as SeaMesh, []) // eslint-disable-line react-hooks/exhaustive-deps
  const sky = useMemo(() => createSky(), [])

  useEffect(() => {
    const u = sea.material.uniforms
    u.uDeepColor.value.set(theme.sea.deep)
    u.uGrazingColor.value.set(theme.sea.grazing)
    u.uSkyColor.value.set(theme.sea.sky)
    u.uFoamColor.value.set(theme.sea.foam)
    u.uSunColor.value.set(theme.sea.sun)
    u.uWaveAmp.value = theme.sea.waveAmp
    u.uOpacity.value = theme.sea.opacity
    u.uSunDir.value.set(...theme.sun.dir).normalize()

    if (theme.skyUrl) {
      let cancelled = false
      new TextureLoader().load(theme.skyUrl, (tex) => {
        if (cancelled) return
        tex.mapping = EquirectangularReflectionMapping
        tex.colorSpace = SRGBColorSpace
        scene.background = tex
        sky.visible = false
      })
      return () => {
        cancelled = true
      }
    }
    scene.background = null
    sky.visible = true
  }, [theme, sea, sky, scene])
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
