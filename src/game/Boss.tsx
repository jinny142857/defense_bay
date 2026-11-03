import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Color, MeshStandardMaterial } from 'three'
import type { Group, Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'
import { getWaveHeight } from './SeaWater.js'

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
  const resolveBossAttack = useGameStore((s) => s.resolveBossAttack)

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

    // PRD 5.3 예고 후 파도 공격, 약점을 맞히면 취소(damageBoss에서 처리)
    attackTimerRef.current -= delta
    if (!telegraphingRef.current && attackTimerRef.current <= 0) {
      telegraphingRef.current = true
      telegraphBossAttack()
      attackTimerRef.current = balance.boss.attackTelegraphSec
    } else if (telegraphingRef.current && attackTimerRef.current <= 0) {
      telegraphingRef.current = false
      resolveBossAttack()
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
  const weakIndex = useGameStore((s) => s.bossWeakPointIndex)
  const bossExposed = useGameStore((s) => s.bossExposed)
  const bossDefeated = useGameStore((s) => s.bossDefeated)
  const phase = useGameStore((s) => s.phase)

  useBossCombatTimers()

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
    if (!groupRef.current) return

    // 바다 한가운데 고정된 자리에 서 있는다 — 등장 연출에서는 카메라가 주위를 돈다(CameraRig).
    groupRef.current.position.z = COMBAT_Z
    if (phase === 'COMBAT') {
      groupRef.current.rotation.y += delta * 0.05
    }

    // 바다 위에 거의 잠기지 않고 크게 서 있도록, 파도 높이만 따라간다.
    groupRef.current.position.y = getWaveHeight(0, groupRef.current.position.z, clock.getElapsedTime()) - SINK
  })

  if (bossDefeated) return null

  const activeName = WEAK_NAMES[weakIndex]

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onHit(e.object.name === activeName, [e.point.x, e.point.y, e.point.z])
  }

  return (
    <group ref={groupRef} position={[0, 0, COMBAT_Z]} scale={MODEL_SCALE} userData={{ hittable: true }}>
      <primitive object={model} onClick={handleClick} />
    </group>
  )
}

useGLTF.preload(MODEL_URL)
