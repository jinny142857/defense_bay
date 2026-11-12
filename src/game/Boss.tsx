import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Color, MeshStandardMaterial } from 'three'
import type { Group, Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'
import { getWaveHeight } from './SeaWater.js'
import { raycastTargets } from './raycastRegistry'

const MODEL_URL = '/assets/boss-volcano-titan.glb'
const MODEL_SCALE = 0.5
const SINK = 0.15 // 거신은 레퍼런스대로 거의 잠기지 않고 물 위로 크게 선다
export const COMBAT_Z = -22

// Boss_VolcanoTitan.glb(SeaMobs_GameAssets) 오브젝트 이름 기준 PRD 5.4 약점 진행(머리→가슴→등)에
// 대응하는 메시를 지정한다. 페이즈마다 이 중 하나만 "열려" 있다 — 나머지 둘은 닫힌 상태로
// 어둡게 유지하고 클릭해도 약점 판정을 주지 않는다.
const WEAK_NAMES = ['Head', 'Core_Torso', 'Back_Upper'] as const
const EXPOSED_COLOR = new Color('#4ad9c9')
const DEFENDED_COLOR = new Color('#4a5a58')
const CLOSED_COLOR = new Color('#1c2422')

function useBossCombatTimers() {
  const phase = useGameStore((s) => s.phase)
  const bossActive = useGameStore((s) => s.bossActive)
  const bossDefeated = useGameStore((s) => s.bossDefeated)
  const setBossExposed = useGameStore((s) => s.setBossExposed)
  const consumeBossExposureBonus = useGameStore((s) => s.consumeBossExposureBonus)
  const telegraphBossAttack = useGameStore((s) => s.telegraphBossAttack)
  const launchBossShell = useGameStore((s) => s.launchBossShell)

  const exposedRef = useRef(true)
  const phaseTimerRef = useRef<number>(balance.boss.exposedSec)
  const attackTimerRef = useRef<number>(balance.boss.attackIntervalSec)
  const telegraphingRef = useRef(false)

  useFrame((_, delta) => {
    if (!bossActive || bossDefeated || phase !== 'COMBAT') return

    // PRD 5.3 노출 6초 -> 방어 4초 반복 (+ 포격 지원 보급상자의 노출 연장 보너스)
    const bonus = consumeBossExposureBonus()
    if (bonus > 0) {
      if (!exposedRef.current) {
        exposedRef.current = true
        setBossExposed(true)
        phaseTimerRef.current = balance.boss.exposedSec + bonus
      } else {
        phaseTimerRef.current += bonus
      }
    }

    phaseTimerRef.current -= delta
    if (phaseTimerRef.current <= 0) {
      exposedRef.current = !exposedRef.current
      phaseTimerRef.current = exposedRef.current ? balance.boss.exposedSec : balance.boss.defendedSec
      setBossExposed(exposedRef.current)
    }

    // PRD 5.3 예고(전조) 후 실제 포탄 발사 — 약점을 맞히면 전조는 취소되지만(damageBoss에서
    // 처리), 일단 포탄이 날아가기 시작하면 격추 여부는 Scene.tsx의 BossShell이 판정한다.
    attackTimerRef.current -= delta
    if (!telegraphingRef.current && attackTimerRef.current <= 0) {
      telegraphingRef.current = true
      telegraphBossAttack()
      attackTimerRef.current = balance.boss.attackTelegraphSec
    } else if (telegraphingRef.current && attackTimerRef.current <= 0) {
      telegraphingRef.current = false
      launchBossShell()
      attackTimerRef.current = balance.boss.attackIntervalSec
    }
  })
}

// 산호 거신 실제 모델(PRD 7.4, 5.4, Blender MCP로 제작한 coral-titan.glb).
export function Boss({
  onHit,
}: {
  onHit: (targetWeak: boolean, point: [number, number, number]) => void
}) {
  const { scene } = useGLTF(MODEL_URL)
  const model = useMemo(() => scene.clone(true), [scene])
  const weakMeshes = useRef<Partial<Record<(typeof WEAK_NAMES)[number], Mesh>>>({})
  const groupRef = useRef<Group>(null)
  const arrivedRef = useRef(false)
  const weakIndex = useGameStore((s) => s.bossWeakPointIndex)
  const bossExposed = useGameStore((s) => s.bossExposed)
  const bossDefeated = useGameStore((s) => s.bossDefeated)
  const bossActive = useGameStore((s) => s.bossActive)
  const bossArrived = useGameStore((s) => s.bossArrived)
  const phase = useGameStore((s) => s.phase)

  useBossCombatTimers()

  // 교전이 시작되기 전(다가오는 중)에는 그냥 커다란 배경 장애물일 뿐, 맞혀도 아무 반응이
  // 없어야 한다 — 조준 십자선이 "맞음"으로 반응하면 혼란스럽다. 실제 교전(bossActive)이
  // 시작된 뒤에야 조준 대상으로 등록한다.
  useEffect(() => {
    const g = groupRef.current
    if (!g || !bossActive) return
    raycastTargets.add(g)
    return () => {
      raycastTargets.delete(g)
    }
  }, [bossActive])

  useEffect(() => {
    weakMeshes.current = {}
    // 내보낸 GLB에 딸려온 Camera/Light는 씬 조명에 영향을 주므로 순회 후 따로 제거한다
    // (순회 도중 제거하면 children 배열이 바뀌어 형제 노드를 건너뛸 수 있음).
    const toRemove: Mesh[] = []
    model.traverse((obj) => {
      const mesh = obj as Mesh
      if ((obj as unknown as { isLight?: boolean }).isLight || (obj as unknown as { isCamera?: boolean }).isCamera) {
        toRemove.push(mesh)
        return
      }
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      if ((WEAK_NAMES as readonly string[]).includes(mesh.name)) {
        mesh.material = (mesh.material as MeshStandardMaterial).clone()
        weakMeshes.current[mesh.name as (typeof WEAK_NAMES)[number]] = mesh
      }
    })
    toRemove.forEach((obj) => obj.removeFromParent())
  }, [model])

  useEffect(() => {
    const activeName = WEAK_NAMES[weakIndex]
    for (const name of WEAK_NAMES) {
      const mesh = weakMeshes.current[name]
      if (!mesh) continue
      const mat = mesh.material as MeshStandardMaterial
      if (name === activeName) {
        const color = bossExposed ? EXPOSED_COLOR : DEFENDED_COLOR
        mat.color.copy(color)
        mat.emissive.copy(color)
        mat.emissiveIntensity = bossExposed ? 1.2 : 0
      } else {
        mat.color.copy(CLOSED_COLOR)
        mat.emissive.copy(CLOSED_COLOR)
        mat.emissiveIntensity = 0
      }
    }
  }, [weakIndex, bossExposed])

  useFrame(({ clock }, delta) => {
    const group = groupRef.current
    if (!group) return

    if (!arrivedRef.current) {
      // 수평선 쪽 스폰 지점에서 교전 거리까지 아주 천천히 다가온다 — 일반 몹처럼 "저 멀리서
      // 서서히 다가오는" 느낌을 거신에게도 준다(기존엔 처음부터 교전 거리에 고정돼 있어서
      // 다가오는 연출이 전혀 없었다는 피드백).
      group.position.z = Math.min(COMBAT_Z, group.position.z + balance.boss.approachSpeed * delta)
      if (group.position.z >= COMBAT_Z) {
        arrivedRef.current = true
        bossArrived()
      }
    } else {
      // 교전 거리에 도착한 뒤로는 그 자리에 고정 — 등장 연출에서는 카메라가 주위를 돈다(CameraRig).
      group.position.z = COMBAT_Z
    }

    if (phase === 'COMBAT') {
      group.rotation.y += delta * 0.05
    }

    // 바다 위에 거의 잠기지 않고 크게 서 있도록, 파도 높이만 따라간다.
    group.position.y = getWaveHeight(0, group.position.z, clock.getElapsedTime()) - SINK
  })

  if (bossDefeated) return null

  const activeName = WEAK_NAMES[weakIndex]

  // onClick 대신 onPointerDown — Mob.tsx와 같은 이유(R3F onClick의 드래그 거리 판정 때문에
  // 간헐적으로 클릭이 씹히는 문제).
  const handleClick = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (!bossActive) return
    onHit(e.object.name === activeName, [e.point.x, e.point.y, e.point.z])
  }

  return (
    <group
      ref={groupRef}
      position={[0, 0, balance.boss.approachSpawnZ]}
      scale={MODEL_SCALE}
      userData={{ hittable: true }}
    >
      <primitive object={model} onPointerDown={handleClick} />
    </group>
  )
}

useGLTF.preload(MODEL_URL)
