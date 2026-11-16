import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Color, MeshStandardMaterial } from 'three'
import type { Group, Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'
import { raycastTargets } from './raycastRegistry'
import type { BossAsset } from '../data/stages'

export const COMBAT_Z = -22

// 공격 전조 중 "달려드는" 느낌을 주는 lunge 연출 수치.
const LUNGE_SPEED = 4 // 0→1 전환 속도(1/초)
const LUNGE_DISTANCE = 2.5 // 방파제 쪽으로 다가서는 거리(m)
const LUNGE_SCALE_BOOST = 0.05 // 몸집이 부풀어 보이는 비율

// PRD 5.4 약점 진행(머리→가슴→등)에 대응하는 메시 3개 — 실제 이름은 보스 모델마다 다르므로
// asset.weakNames(data/stages.ts)로 받는다. 페이즈마다 이 중 하나만 "열려" 있다 — 나머지
// 둘은 닫힌 상태로 어둡게 유지하고 클릭해도 약점 판정을 주지 않는다.
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

// 보스 실제 모델(PRD 7.4, 5.4) — 어떤 모델을 쓸지는 스테이지별 bossAsset(data/stages.ts)이 정한다.
export function Boss({
  asset,
  onHit,
}: {
  asset: BossAsset
  onHit: (targetWeak: boolean, point: [number, number, number]) => void
}) {
  const { scene } = useGLTF(asset.modelUrl)
  const model = useMemo(() => scene.clone(true), [scene])
  const weakMeshes = useRef<Partial<Record<string, Mesh>>>({})
  const groupRef = useRef<Group>(null)
  const arrivedRef = useRef(false)
  const weakIndex = useGameStore((s) => s.bossWeakPointIndex)
  const bossExposed = useGameStore((s) => s.bossExposed)
  const bossDefeated = useGameStore((s) => s.bossDefeated)
  const bossActive = useGameStore((s) => s.bossActive)
  const bossArrived = useGameStore((s) => s.bossArrived)
  const bossAttackTelegraphed = useGameStore((s) => s.bossAttackTelegraphed)
  const phase = useGameStore((s) => s.phase)
  const lungeRef = useRef(0)

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
      // 해파리 대왕 같은 반투명(alphaMode BLEND) 메시는 depthWrite를 켜두면 겹친 부분이
      // 깜빡인다(SeaMobs 가이드) — 투명 재질은 전부 depthWrite를 꺼서 막는다.
      const mat = mesh.material as MeshStandardMaterial
      if (mat?.transparent) mat.depthWrite = false
      if (asset.weakNames.includes(mesh.name)) {
        mesh.material = (mesh.material as MeshStandardMaterial).clone()
        weakMeshes.current[mesh.name] = mesh
      }
    })
    toRemove.forEach((obj) => obj.removeFromParent())
  }, [model, asset.weakNames])

  useEffect(() => {
    const activeName = asset.weakNames[weakIndex]
    for (const name of asset.weakNames) {
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
  }, [weakIndex, bossExposed, asset.weakNames])

  useFrame((_, delta) => {
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

    // 파도를 따라 출렁이지 않고 고정 높이로 다가온다 — 위아래로 움직이면 다가오는 느낌이
    // 묻혀 보인다는 피드백으로, 전진(z)만 보이게 한다.
    group.position.y = -asset.sink

    // 포격 전조(telegraph) 중에는 방파제 쪽으로 살짝 다가서며 몸집을 부풀렸다가, 포탄이
    // 발사되면 원래 자리로 돌아온다 — "보스 애니메이션이 없다"는 피드백으로 추가한 공격
    // 동작(위아래 출렁임이 아니라 Z축 전진/스케일 변화라 "멀미나는" 움직임과는 다르다).
    const lungeTarget = bossAttackTelegraphed ? 1 : 0
    const lungeStep = Math.min(Math.abs(lungeTarget - lungeRef.current), LUNGE_SPEED * delta)
    lungeRef.current += Math.sign(lungeTarget - lungeRef.current) * lungeStep
    if (arrivedRef.current) group.position.z = COMBAT_Z + lungeRef.current * LUNGE_DISTANCE
    group.scale.setScalar(asset.scale * (1 + lungeRef.current * LUNGE_SCALE_BOOST))
  })

  if (bossDefeated) return null

  const activeName = asset.weakNames[weakIndex]

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
      scale={asset.scale}
      userData={{ hittable: true }}
    >
      <primitive object={model} onPointerDown={handleClick} />
    </group>
  )
}

useGLTF.preload('/assets/boss-volcano-titan.glb')
useGLTF.preload('/assets/boss-jelly-king.glb')
