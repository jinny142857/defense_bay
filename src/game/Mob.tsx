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
const WALL_TRIGGER_Z = -5
const toTarget = new Vector3()

export function Mob({
  kind,
  startX,
  startZ,
  onReachWall,
  onHit,
  onDamaged,
  onKilled,
}: {
  kind: MobKind
  startX: number
  startZ: number
  onReachWall: () => void
  // 발사 쿨다운 통과 여부만 판정(피격 이펙트/트레이서는 부모가 그린다). true면 실제로 발사된 것.
  onHit: (point: [number, number, number]) => boolean
  onDamaged: (point: [number, number, number], damage: number) => void
  onKilled: () => void
}) {
  const { speed, sink, scale, hp: maxHp } = balance.mobs[kind]
  const { scene } = useGLTF(MOB_URLS[kind])
  const model = useMemo(() => scene.clone(true), [scene])
  const groupRef = useRef<Group>(null)
  const doneRef = useRef(false)
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

    // 방파제(원점) 쪽으로 이동, 모델 정면(+Z)이 이동 방향을 보도록 회전
    toTarget.set(-group.position.x, 0, -group.position.z).normalize()
    group.position.addScaledVector(toTarget, speed * speedMul * delta)
    group.rotation.y = Math.atan2(toTarget.x, toTarget.z)

    // 파도 위에 떠서 일부 잠김 + 경사에 따라 살짝 기울기
    const t = clock.getElapsedTime()
    const { x, z } = group.position
    group.position.y = getWaveHeight(x, z, t) - sink
    const e = 1.5
    const dx = getWaveHeight(x + e, z, t) - getWaveHeight(x - e, z, t)
    const dz = getWaveHeight(x, z + e, t) - getWaveHeight(x, z - e, t)
    group.rotation.z = -dx * 0.25
    group.rotation.x = dz * 0.25

    if (z > WALL_TRIGGER_Z) {
      doneRef.current = true
      onReachWall()
    }
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
      onKilled()
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
