import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Vector3 } from 'three'
import type { Group, Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { balance } from '../config/balance'
import { useGameStore } from '../state/gameStore'
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
// 실제 이동 속도가 일정해도, 원근 때문에 멀리 있을 땐 화면상 움직임이 아주 느려 보이다가
// 가까워질수록 급격히 빨라 보인다("멀리선 느리다가 가까우면 갑자기 빨라진다"는 피드백).
// 체감 속도를 고르게 하려면 실제 속도가 거리에 비례해야 한다(속도÷거리 = 각속도 ≈ 일정) —
// 멀 때는 더 빠르게, 가까울 때는 더 느리게 움직이도록 거리 기반 배율을 곱한다.
const SPEED_REFERENCE_DIST = 70
const SPEED_FACTOR_MIN = 0.5
const SPEED_FACTOR_MAX = 2.2
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
      const dist = Math.hypot(group.position.x, group.position.z)
      const distanceFactor = Math.min(
        SPEED_FACTOR_MAX,
        Math.max(SPEED_FACTOR_MIN, dist / SPEED_REFERENCE_DIST),
      )
      toTarget.set(-group.position.x, 0, -group.position.z).normalize()
      group.position.addScaledVector(toTarget, speed * speedMul * distanceFactor * delta)
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

    // 수면 높이 그대로 따라가며 위아래로 흔들리는 게 어지럽다는 피드백 — 잠기는 깊이만큼
    // 고정된 높이에 떠 있게 하고(출렁임 없음), 기울기도 더 이상 흔들지 않는다.
    group.position.y = -sink
  })

  // onClick이 아니라 onPointerDown을 쓴다 — R3F의 onClick은 pointerdown/up 사이 이동 거리가
  // 조금만 넘어가도(드래그로 간주해) 조용히 씹어버린다. Sea의 "빗맞음" 처리는 원래도
  // onPointerDown이라 항상 잘 됐는데 몹/보스/보급상자만 onClick이라 간헐적으로 안 맞는 걸로
  // 보였을 가능성이 커서 전부 onPointerDown으로 통일한다.
  const handleClick = (e: ThreeEvent<PointerEvent>) => {
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
      onPointerDown={handleClick}
      userData={{ hittable: true }}
    >
      <primitive object={model} />
      <MobHealthBar hpRatio={hp / maxHp} yOffset={HEALTH_BAR_Y[kind]} />
      {/* 모델이 다리/집게 사이 빈틈이 많아 클릭이 그 틈으로 빠져나가 "안 맞는다"는 피드백 —
          보이지 않는 구 히트박스 2개를 위아래로 겹쳐서(몸통 위/아래) 캡슐처럼 전신을 덮어 판정을
          관대하게 한다. 너무 크게 하면(이전 1.9/1.5) 스폰 간격을 좁힌 뒤로 몹끼리 가까이 붙어있을
          때 옆 몹의 히트박스를 가로채 "엉뚱한 애가 맞는" 역효과가 날 수 있어 적당히 줄였다. */}
      <mesh position={[0, HEALTH_BAR_Y[kind] * 0.2, 0]}>
        <sphereGeometry args={[1.1, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[0, HEALTH_BAR_Y[kind] * 0.75, 0]}>
        <sphereGeometry args={[0.9, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

useGLTF.preload(MOB_URLS.crab)
useGLTF.preload(MOB_URLS.frogTurtle)
