import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'

// Handoff 결정사항: GLB 안에서 이름이 `weak_`로 시작하는 오브젝트를 약점 히트박스로 자동 인식한다.
// 지금은 placeholder 메시이지만, 실제 GLB로 교체되어도 이 네이밍 규칙만 지키면 코드 변경이 필요 없다.
const WEAK_NAMES = ['weak_head', 'weak_core', 'weak_back'] as const
// 본체 캡슐 반지름(1.6)보다 바깥으로 충분히 튀어나오게 배치해야 레이캐스트가
// 본체에 가려지지 않고 약점 구체에 먼저 닿는다 (약점이 본체 속에 파묻혀 있으면
// 클릭이 항상 본체로 판정되는 버그가 있었음).
const WEAK_LOCAL_POS: [number, number, number][] = [
  [0, 1.1, 3.0],
  [0, -0.2, 3.0],
  [0, -0.2, -3.0],
]

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

// M1 임시 도형: 실제 산호 거신 GLB(PRD 7.4, 5.4)는 이후 마일스톤에서 교체한다.
export function Boss({ onHit }: { onHit: (targetWeak: boolean) => void }) {
  const groupRef = useRef<Group>(null)
  const weakIndex = useGameStore((s) => s.bossWeakPointIndex)
  const bossExposed = useGameStore((s) => s.bossExposed)
  const bossDefeated = useGameStore((s) => s.bossDefeated)

  useBossCombatTimers()

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.05
  })

  if (bossDefeated) return null

  const weakName = WEAK_NAMES[weakIndex]
  const weakColor = bossExposed ? '#4ad9c9' : '#4a5a58'

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const isWeak = e.object.name.startsWith('weak_')
    onHit(isWeak)
  }

  return (
    <group ref={groupRef} position={[0, 0.6, -22]}>
      <mesh name="boss_body" castShadow onClick={handleClick}>
        <capsuleGeometry args={[1.6, 3, 6, 10]} />
        <meshStandardMaterial color="#2f6f5e" roughness={0.7} />
      </mesh>
      <mesh name={weakName} position={WEAK_LOCAL_POS[weakIndex]} onClick={handleClick}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial
          color={weakColor}
          emissive={weakColor}
          emissiveIntensity={bossExposed ? 1.2 : 0}
        />
      </mesh>
    </group>
  )
}
