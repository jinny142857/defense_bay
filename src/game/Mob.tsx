import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Vector3 } from 'three'
import type { Group, Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { balance } from '../config/balance'
import { useGameStore } from '../state/gameStore'
import { getWaveHeight } from './SeaWater.js'
import { MobHealthBar } from './MobHealthBar'
import { raycastTargets } from './raycastRegistry'
import type { MobKind } from '../types'

// 두 몹 모델(SeaMobs_GameAssets, README_for_ClaudeCode.md 가이드) 모두 정면이 +Z(플레이어 쪽)를 향한다.
const MOB_URLS: Record<MobKind, string> = {
  crab: '/assets/mob-spike-crab.glb',
  frogTurtle: '/assets/mob-shell-toad.glb',
}
// 체력바를 몹 모델 위로 띄우는 높이(모델별 키 차이 반영, scale=1 기준).
const HEALTH_BAR_Y: Record<MobKind, number> = {
  crab: 2.0,
  frogTurtle: 2.5,
}
// 방파제 몸체(Breakwater.tsx)의 바다 쪽 면이 z=-7 부근이라, 거기서 멈춰야 벽을 넘어 들어오지
// 않는다(예전 -5는 벽 안쪽, 탱크(z=-6)보다도 더 앞까지 들어와 버리는 값이었다).
const WALL_TRIGGER_Z = -7.3
// 방파제에 닿은 뒤 죽이지 못하면 이 시간만큼 들러붙어 "공격"하다가 사라진다(내구도 피해는
// 닿는 순간 이미 한 번 적용됨 — 계속 눌러앉아 있는 게 아니라 정리용 타임아웃).
const WALL_LINGER_SEC = 6
const toTarget = new Vector3()

export function Mob({
  kind,
  startX,
  startZ,
  onReachWall,
  onExpire,
  onHit,
  onDamaged,
  onKilled,
}: {
  kind: MobKind
  startX: number
  startZ: number
  onReachWall: () => void
  // 방파제에서 안 죽고 버티다가 타임아웃으로 정리될 때(통계 반영 없이 조용히 제거).
  onExpire: () => void
  // 발사 쿨다운 통과 여부만 판정(피격 이펙트/트레이서는 부모가 그린다). true면 실제로 발사된 것.
  onHit: (point: [number, number, number]) => boolean
  onDamaged: (point: [number, number, number], damage: number) => void
  // atWall: 방파제에 도달해 이미 내구도/남은 괴수 집계가 끝난 뒤의 "마무리 처치"인지 구분한다
  // (이중 집계 방지 — 부모가 점수/카운트 반영 여부를 다르게 처리).
  onKilled: (atWall: boolean) => void
}) {
  const { speed, sink, scale, hp: maxHp } = balance.mobs[kind]
  const { scene } = useGLTF(MOB_URLS[kind])
  const model = useMemo(() => scene.clone(true), [scene])
  const groupRef = useRef<Group>(null)
  const doneRef = useRef(false)
  const atWallRef = useRef(false)
  const wallAgeRef = useRef(0)
  const [hp, setHp] = useState<number>(maxHp)
  const phase = useGameStore((s) => s.phase)
  const slow = useGameStore((s) => s.activeSupplyQuestion !== null)

  useEffect(() => {
    model.traverse((obj) => {
      if ((obj as Mesh).isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })
  }, [model])

  useEffect(() => {
    const g = groupRef.current
    if (!g) return
    raycastTargets.add(g)
    return () => {
      raycastTargets.delete(g)
    }
  }, [])

  useFrame(({ clock }, delta) => {
    const group = groupRef.current
    if (doneRef.current || !group) return
    if (phase === 'BOSS_INTRO') return
    const speedMul = slow ? 0.15 : 1
    const t = clock.getElapsedTime()

    if (!atWallRef.current) {
      // 방파제(원점) 쪽으로 이동, 모델 정면(+Z)이 이동 방향을 보도록 회전
      toTarget.set(-group.position.x, 0, -group.position.z).normalize()
      group.position.addScaledVector(toTarget, speed * speedMul * delta)
      group.rotation.y = Math.atan2(toTarget.x, toTarget.z)

      if (group.position.z > WALL_TRIGGER_Z) {
        atWallRef.current = true
        group.position.z = WALL_TRIGGER_Z
        onReachWall()
      }
    } else {
      // 방파제에 들러붙어 할퀴듯 앞뒤로 조금씩 흔들리며 "공격"하는 모션
      group.position.z = WALL_TRIGGER_Z + Math.sin(t * 4) * 0.2 + 0.2
      wallAgeRef.current += delta
      if (wallAgeRef.current >= WALL_LINGER_SEC) {
        doneRef.current = true
        onExpire()
        return
      }
    }

    // 파도 위에 떠서 일부 잠김 + 경사에 따라 살짝 기울기
    const { x, z } = group.position
    group.position.y = getWaveHeight(x, z, t) - sink
    const e = 1.5
    const dx = getWaveHeight(x + e, z, t) - getWaveHeight(x - e, z, t)
    const dz = getWaveHeight(x, z + e, t) - getWaveHeight(x, z - e, t)
    group.rotation.z = -dx * 0.25
    group.rotation.x = dz * 0.25
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (doneRef.current || !groupRef.current) return
    const p = groupRef.current.position
    const point: [number, number, number] = [p.x, p.y, p.z]
    // 쿨다운에 막혀 발사가 거부된 경우 done 처리하지 않아야 다음 클릭에 다시 맞출 수 있다
    // (거부된 클릭에서 done을 먼저 세우면 개체가 영구히 멈춘 채 반응 없는 상태로 남는 버그가 있었음)
    if (!onHit(point)) return
    const dmg = useGameStore.getState().getEffectiveAttack()
    const nextHp = Math.max(0, hp - dmg)
    setHp(nextHp)
    onDamaged(point, dmg)
    if (nextHp <= 0) {
      doneRef.current = true
      onKilled(atWallRef.current)
    }
  }

  return (
    <group
      ref={groupRef}
      position={[startX, 0, startZ]}
      scale={scale}
      onClick={handleClick}
      userData={{ hittable: true }}
    >
      <primitive object={model} />
      <MobHealthBar hpRatio={hp / maxHp} yOffset={HEALTH_BAR_Y[kind]} />
    </group>
  )
}

useGLTF.preload(MOB_URLS.crab)
useGLTF.preload(MOB_URLS.frogTurtle)
