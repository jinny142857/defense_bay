import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Color, MeshStandardMaterial, Vector3 } from 'three'
import type { Group, Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'
import { raycastTargets } from './raycastRegistry'
import { bossMouthSignal } from './bossMouthSignal'
import type { BossAsset } from '../data/stages'

const mouthWorldPos = new Vector3()

export const COMBAT_Z = -22

// 처음엔 안개 속에 있는 듯 흐릿하다가, 다가올수록 또렷하게 "등장하는" 느낌을 준다 —
// 스폰 지점(약 -150)에서는 거의 안 보이다가, 이 지점(-95)을 지나면 완전히 또렷해진다.
const FOG_EMERGE_END_Z = -95
const FOG_EMERGE_MIN_OPACITY = 0.06

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
  const fadeMaterialsRef = useRef<{ mat: MeshStandardMaterial; originalTransparent: boolean }[]>([])
  const groupRef = useRef<Group>(null)
  const arrivedRef = useRef(false)
  const weakIndex = useGameStore((s) => s.bossWeakPointIndex)
  const bossExposed = useGameStore((s) => s.bossExposed)
  const bossDefeated = useGameStore((s) => s.bossDefeated)
  const bossActive = useGameStore((s) => s.bossActive)
  const bossArrived = useGameStore((s) => s.bossArrived)

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
    const fadeEntries: { mat: MeshStandardMaterial; originalTransparent: boolean }[] = []
    model.traverse((obj) => {
      const mesh = obj as Mesh
      if ((obj as unknown as { isLight?: boolean }).isLight || (obj as unknown as { isCamera?: boolean }).isCamera) {
        toRemove.push(mesh)
        return
      }
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      // 캐시된 원본 머티리얼을 그대로 건드리면 다른 보스 인스턴스/다음 로드에도 영향을 주므로
      // 전부 복제해서 쓴다 — 원래는 약점 메시만 복제했지만, 이제 접근 중 안개 페이드 효과
      // (opacity)를 모든 메시에 걸어야 해서 전체로 넓혔다.
      const mat = (mesh.material as MeshStandardMaterial).clone()
      mesh.material = mat
      const originalTransparent = mat.transparent
      // 해파리 대왕 같은 반투명(alphaMode BLEND) 메시는 depthWrite를 켜두면 겹친 부분이
      // 깜빡인다(SeaMobs 가이드) — 투명 재질은 전부 depthWrite를 꺼서 막는다.
      if (originalTransparent) mat.depthWrite = false
      fadeEntries.push({ mat, originalTransparent })
      if (asset.weakNames.includes(mesh.name)) {
        weakMeshes.current[mesh.name] = mesh
      }
    })
    toRemove.forEach((obj) => obj.removeFromParent())
    fadeMaterialsRef.current = fadeEntries
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
      // 서서히 다가오는" 느낌을 거신에게도 준다. 뒤로 물러나거나 커졌다 작아지는 연출 없이,
      // 계속 같은 방향(+Z, 방파제 쪽)으로만 천천히 전진한다는 피드백을 반영한다.
      group.position.z = Math.min(COMBAT_Z, group.position.z + balance.boss.approachSpeed * delta)
      if (group.position.z >= COMBAT_Z) {
        arrivedRef.current = true
        bossArrived()
      }
    } else {
      // 교전 거리에 도착한 뒤로는 그 자리에 고정.
      group.position.z = COMBAT_Z
    }

    // 회전 없이 항상 정면(+Z, 방파제 쪽)만 보여준다 — 천천히 돌면서 옆모습/뒷모습이 보이던
    // 걸 "앞모습으로만 다가오게 해달라"는 피드백으로 뺐다.
    group.rotation.y = 0

    // 파도를 따라 출렁이지 않고 고정 높이로 다가온다 — 위아래로 움직이면 다가오는 느낌이
    // 묻혀 보인다는 피드백으로, 전진(z)만 보이게 한다.
    group.position.y = -asset.sink

    // 멀리 있을 땐 안개 속에 있는 듯 흐릿하다가, 다가올수록 또렷해지는 "등장" 연출.
    const emergeFactor = Math.min(
      1,
      Math.max(0, (group.position.z - balance.boss.approachSpawnZ) / (FOG_EMERGE_END_Z - balance.boss.approachSpawnZ)),
    )
    for (const { mat, originalTransparent } of fadeMaterialsRef.current) {
      if (emergeFactor < 1) {
        mat.transparent = true
        mat.depthWrite = false
        mat.opacity = FOG_EMERGE_MIN_OPACITY + (1 - FOG_EMERGE_MIN_OPACITY) * emergeFactor
      } else if (mat.opacity !== 1 || mat.transparent !== originalTransparent) {
        mat.opacity = 1
        mat.transparent = originalTransparent
        mat.depthWrite = !originalTransparent
      }
    }

    // 포탄이 보스몹한테서 날아가는 것처럼 보이게, 약점(머리) 메시의 실시간 월드 좌표를
    // Scene.tsx의 BossShell 발사 지점으로 공유한다(muzzleSignal과 같은 패턴).
    const mouthMesh = weakMeshes.current[asset.weakNames[0]]
    if (mouthMesh) {
      mouthMesh.getWorldPosition(mouthWorldPos)
      bossMouthSignal.x = mouthWorldPos.x
      bossMouthSignal.y = mouthWorldPos.y
      bossMouthSignal.z = mouthWorldPos.z
    }
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
