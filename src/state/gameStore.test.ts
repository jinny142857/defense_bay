import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'
import { balance } from '../config/balance'

function resetToCombat(waveNumber = 1, crabCount = 3) {
  useGameStore.setState({
    phase: 'COMBAT',
    waveNumber,
    durability: balance.combat.breakwaterMaxDurability,
    attackBuffPct: 0,
    fireRateBuffPct: 0,
    crabsTotal: crabCount,
    crabsRemaining: crabCount,
    debriefQuestions: [],
    debriefAttempts: [],
    stageAttempts: [],
    usedQuestionIds: new Set(),
    bossActive: false,
    bossTriggered: false,
    bossDefeated: false,
    bossHp: balance.boss.maxHp,
    bossWeakPointIndex: 0,
    bossExposed: true,
  })
}

describe('COMBAT -> DEBRIEF gate (남은 괴수 0일 때만)', () => {
  beforeEach(() => resetToCombat())

  it('꼬마 게가 남아있으면 DEBRIEF로 전환되지 않는다', () => {
    useGameStore.getState().defeatCrab()
    useGameStore.getState().defeatCrab()
    expect(useGameStore.getState().crabsRemaining).toBe(1)
    expect(useGameStore.getState().phase).toBe('COMBAT')
  })

  it('남은 괴수가 0이 되면 DEBRIEF로 전환되고 복기 문제 3개가 채워진다', () => {
    useGameStore.getState().defeatCrab()
    useGameStore.getState().defeatCrab()
    useGameStore.getState().defeatCrab()
    expect(useGameStore.getState().crabsRemaining).toBe(0)
    expect(useGameStore.getState().phase).toBe('DEBRIEF')
    expect(useGameStore.getState().debriefQuestions).toHaveLength(balance.debrief.questionCount)
  })
})

describe('DEBRIEF -> MAINTENANCE gate (복기 3문항을 모두 풀었을 때만)', () => {
  beforeEach(() => {
    resetToCombat()
    useGameStore.getState().defeatCrab()
    useGameStore.getState().defeatCrab()
    useGameStore.getState().defeatCrab()
  })

  it('복기 문제를 1~2개만 풀면 MAINTENANCE로 전환되지 않는다', () => {
    useGameStore.getState().answerDebrief(0, 2000)
    expect(useGameStore.getState().phase).toBe('DEBRIEF')
    useGameStore.getState().answerDebrief(0, 2000)
    expect(useGameStore.getState().phase).toBe('DEBRIEF')
    expect(useGameStore.getState().debriefAttempts).toHaveLength(2)
  })

  it('정답 여부와 무관하게 3문제를 모두 풀면 MAINTENANCE로 전환된다 (정답률 보상 없음)', () => {
    useGameStore.getState().answerDebrief(-1, 2000)
    useGameStore.getState().answerDebrief(-1, 2000)
    useGameStore.getState().answerDebrief(-1, 2000)
    expect(useGameStore.getState().debriefAttempts).toHaveLength(3)
    expect(useGameStore.getState().phase).toBe('MAINTENANCE')
  })
})

describe('웨이브 루프 (MAINTENANCE 종료 후 분기)', () => {
  it('1·2웨이브 종료 시 다음 웨이브 PRE_CHECK로 복귀한다', () => {
    resetToCombat(1)
    useGameStore.setState({ phase: 'MAINTENANCE' })
    useGameStore.getState().finishMaintenance()
    expect(useGameStore.getState().waveNumber).toBe(2)
    expect(useGameStore.getState().phase).toBe('PRE_CHECK')
  })

  it('3웨이브(보스 포함) 종료 시 STAGE_RESULT로 전환하고 성실도/별점을 기록한다', () => {
    resetToCombat(3)
    useGameStore.setState({ phase: 'MAINTENANCE' })
    useGameStore.getState().finishMaintenance()
    const s = useGameStore.getState()
    expect(s.phase).toBe('STAGE_RESULT')
    expect(s.stageStars).not.toBeNull()
    expect(s.stageGrade).not.toBeNull()
    expect(s.ownedWeapons).toContain('rapid_cannon')
  })
})

describe('보스 약점 데미지 배율', () => {
  beforeEach(() => {
    resetToCombat(3, 0)
    useGameStore.setState({ bossActive: true, bossDefeated: false, bossHp: balance.boss.maxHp, bossExposed: true })
  })

  it('노출 상태에서 약점을 맞히면 데미지가 크게 들어간다', () => {
    const before = useGameStore.getState().bossHp
    useGameStore.getState().damageBoss(true)
    const after = useGameStore.getState().bossHp
    const dmg = before - after
    // weakMultiplier(3.0) 기준 데미지가 normalMultiplier(0.1) 기준보다 훨씬 커야 한다
    expect(dmg).toBeGreaterThan(before * 0.05)
  })

  it('방어 상태(bossExposed=false)에서는 약점을 노려도 일반 데미지만 들어간다', () => {
    useGameStore.setState({ bossExposed: false })
    const before = useGameStore.getState().bossHp
    useGameStore.getState().damageBoss(true)
    const after = useGameStore.getState().bossHp
    const weakDmg = before - after

    useGameStore.setState({ bossHp: before, bossExposed: false })
    useGameStore.getState().damageBoss(false)
    const normalDmg = before - useGameStore.getState().bossHp

    expect(weakDmg).toBeCloseTo(normalDmg, 5)
  })
})

describe('격납고 강화 게이트 (Lv5 이상은 문제 통과 필요)', () => {
  beforeEach(() => {
    useGameStore.setState({
      parts: 10000,
      weaponLevels: { high_explosive: 4 },
      pendingUpgrade: null,
      usedQuestionIds: new Set(),
    })
  })

  it('Lv4->Lv5 강화는 문제를 먼저 요구하고, 오답이면 레벨이 그대로이며 부품을 환불한다', () => {
    const partsBefore = useGameStore.getState().parts
    useGameStore.getState().requestUpgrade('high_explosive')
    const pending = useGameStore.getState().pendingUpgrade
    expect(pending).not.toBeNull()
    expect(useGameStore.getState().weaponLevels.high_explosive).toBe(4)

    const wrongChoice = pending!.question.answer === 0 ? 1 : 0
    useGameStore.getState().answerUpgrade(wrongChoice, 2000)

    expect(useGameStore.getState().weaponLevels.high_explosive).toBe(4)
    expect(useGameStore.getState().parts).toBe(partsBefore)
    expect(useGameStore.getState().pendingUpgrade).toBeNull()
  })

  it('Lv4->Lv5 강화 문제에 정답이면 레벨이 오른다', () => {
    useGameStore.getState().requestUpgrade('high_explosive')
    const pending = useGameStore.getState().pendingUpgrade!
    useGameStore.getState().answerUpgrade(pending.question.answer, 2000)

    expect(useGameStore.getState().weaponLevels.high_explosive).toBe(5)
    expect(useGameStore.getState().pendingUpgrade).toBeNull()
  })
})
