import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { idbStorage } from './idbStorage'
import { balance } from '../config/balance'
import { STARTING_WEAPON_ID, WEAPON_DEFS } from '../data/weapons'
import { STARTING_VEHICLE_ID, VEHICLE_DEFS } from '../data/vehicles'
import { getEffectiveBossMaxHp, getStageDef, STAGE_DEFS } from '../data/stages'
import { computeDiligenceGrade, computeStars } from './diligence'
import type {
  ActiveSupplyQuestion,
  Attempt,
  DiligenceGrade,
  GamePhase,
  PendingUpgrade,
  PendingVehiclePurchase,
  PreCheckSlot,
  Question,
  QuestionContext,
  SupplyBoxType,
} from '../types'
import stage1Questions from '../data/questions/math-g3-2-fraction.json'
import stage2Questions from '../data/questions/math-g3-2-fraction-advanced.json'

// 스테이지마다 다른 문제 은행에서 뽑는다 — 스테이지 2는 "같은 분수 단원, 심화" 문제로 채운다.
const QUESTION_POOLS: Record<number, Question[]> = {
  1: stage1Questions as Question[],
  2: stage2Questions as Question[],
}

function getQuestionPool(stageId: number): Question[] {
  return QUESTION_POOLS[stageId] ?? QUESTION_POOLS[1]
}

type WeakIndex = 0 | 1 | 2

function pickQuestions(stageId: number, count: number, excludeIds: Set<string>): Question[] {
  const pool = getQuestionPool(stageId).filter((q) => !excludeIds.has(q.id))
  const picked: Question[] = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    picked.push(pool.splice(idx, 1)[0])
  }
  return picked
}

interface GameState {
  phase: GamePhase
  waveNumber: number
  durability: number
  attackBuffPct: number
  fireRateBuffPct: number
  score: number

  parts: number
  stagePartsEarned: number
  stageAttempts: Attempt[]
  rapidStreak: number
  readLockMultiplier: number

  currentStageId: number
  maxStageUnlocked: number
  stageClears: Partial<Record<number, { stars: 1 | 2 | 3; grade: DiligenceGrade }>>

  stageStars: 1 | 2 | 3 | null
  stageGrade: DiligenceGrade | null

  preCheckSlots: PreCheckSlot[]
  preCheckQuestions: Record<string, Question>
  usedQuestionIds: Set<string>

  crabsTotal: number
  crabsRemaining: number
  crabsDefeated: number

  debriefQuestions: Question[]
  debriefAttempts: Attempt[]

  maintenanceRepairQuestion: Question | null
  maintenanceRepairDone: boolean
  maintenanceBonusQuestion: Question | null
  maintenanceBonusUsed: number

  activeSupplyQuestion: ActiveSupplyQuestion | null
  supplyBombardPulse: number
  infiniteReloadUntil: number
  // 보급상자를 맞혀서 문제를 풀면 실제로 뭘 얻었는지("공중 포격 지원!", "부품 +8" 등) 화면에
  // 보여주기 위한 신호 — pulse를 올려서 같은 문구가 연속으로 떠도 애니메이션이 다시 트리거되게 한다.
  supplyResultText: string | null
  supplyResultPulse: number

  bossActive: boolean
  bossTriggered: boolean
  bossDefeated: boolean
  bossHp: number
  bossWeakPointIndex: WeakIndex
  bossExposed: boolean
  bossAttackTelegraphed: boolean
  bossExposureBonusSec: number
  // 전조(telegraph) 뒤 실제로 포탄이 날아가는 중인지 — HUD 경고 문구와, 포탄을 쏴서 막을 수
  // 있는 타이밍인지를 구분하는 데 쓴다. pulse는 Scene.tsx에 "포탄 하나 새로 띄워라" 신호를
  // 주기 위해 매번 값을 올린다(같은 값이 연달아 와도 useEffect가 다시 트리거되게).
  bossShellFlying: boolean
  bossShellPulse: number

  ownedWeapons: string[]
  equippedWeaponId: string
  weaponLevels: Record<string, number>
  pendingUpgrade: PendingUpgrade | null

  ownedVehicles: string[]
  equippedVehicleId: string
  pendingVehiclePurchase: PendingVehiclePurchase | null

  // --- actions ---
  goToLobby: () => void
  startStage: (stageId?: number) => void
  retryWave: () => void
  beginPreCheck: () => void
  answerPreCheck: (slotKey: PreCheckSlot['key'], choice: number, responseMs: number) => void

  beginWave: () => void
  defeatCrab: () => void
  crabReachedBreakwater: () => void

  // 보스가 수평선에서 천천히 다가와(Boss.tsx) 교전 거리에 실제로 도착했을 때 호출 — 그제서야
  // 등장 연출(BOSS_INTRO)이 시작된다(예전엔 일반 몹 절반을 처리하면 트리거했는데, 그러면
  // 보스가 다가오는 모습 없이 갑자기 교전 거리에 나타난 것처럼 보였다).
  bossArrived: () => void
  finishBossIntro: () => void
  damageBoss: (targetWeak: boolean) => { damage: number; critical: boolean } | null
  getEffectiveAttack: () => number
  setBossExposed: (exposed: boolean) => void
  consumeBossExposureBonus: () => number
  telegraphBossAttack: () => void
  launchBossShell: () => void
  interceptBossShell: () => void
  resolveBossAttack: () => void

  openSupplyBox: (boxType: SupplyBoxType) => boolean
  answerSupplyBox: (choice: number, responseMs: number) => void

  answerDebrief: (choice: number, responseMs: number) => void

  answerMaintenanceRepair: (choice: number, responseMs: number) => void
  answerMaintenanceBonus: (choice: number, responseMs: number) => void
  finishMaintenance: () => void

  goToHangar: () => void
  equipWeapon: (weaponId: string) => void
  equipVehicle: (vehicleId: string) => void
  requestUpgrade: (weaponId: string) => void
  answerUpgrade: (choice: number, responseMs: number) => void
  requestVehiclePurchase: (vehicleId: string) => void
  answerVehiclePurchase: (choice: number, responseMs: number) => void

  // --- guards (derived, used by tests and UI) ---
  canEnterDebrief: () => boolean
  canEnterMaintenance: () => boolean
}

type SetFn = (
  partial: Partial<GameState> | ((state: GameState) => Partial<GameState>),
) => void
type GetFn = () => GameState

function recordAttempt(
  set: SetFn,
  get: GetFn,
  partial: { questionId: string; context: QuestionContext; choice: number; correct: boolean; responseMs: number },
) {
  const s = get()
  const attempt: Attempt = { ...partial, createdAt: Date.now() }
  const attempts = [...s.stageAttempts, attempt]
  const isRapid = partial.responseMs < balance.diligence.rapidResponseMs
  const rapidStreak = isRapid ? s.rapidStreak + 1 : 0
  const readLockMultiplier = rapidStreak >= balance.diligence.rapidStreakForDoubleLock ? 2 : 1
  set({ stageAttempts: attempts, rapidStreak, readLockMultiplier })
}

// 장착 무기 기본 공격력에 강화 레벨/버프를 반영한 유효 공격력. damageBoss와 Mob.tsx의 몹 피격
// 데미지 계산이 같은 공식을 쓰도록 여기 한 곳에 모은다.
// attackBuffPct는 웨이브를 넘길 때 리셋되지 않고 출격 점검 결과가 계속 누적되는 값이라(한 스테이지
// 안에서 오답이 겹치면 계속 깎인다), 하한선 없이 곱하면 이론상 공격력이 0 또는 음수까지 떨어질 수
// 있다 — "맞혀도 안 죽는다" 버그로 보일 수 있어 최소 배율을 둔다.
function getEffectiveAttack(get: GetFn): number {
  const s = get()
  const weapon = WEAPON_DEFS[s.equippedWeaponId]
  const level = s.weaponLevels[s.equippedWeaponId] ?? 1
  const buffMultiplier = Math.max(0.4, 1 + s.attackBuffPct)
  const vehicleMultiplier = 1 + (VEHICLE_DEFS[s.equippedVehicleId]?.attackPct ?? 0)
  return weapon.baseAttack * (1 + balance.hangar.attackPctPerLevel * (level - 1)) * buffMultiplier * vehicleMultiplier
}

function tryEnterDebrief(set: SetFn, get: GetFn) {
  if (!get().canEnterDebrief()) return
  const s = get()
  const used = s.usedQuestionIds
  const picked = pickQuestions(s.currentStageId, balance.debrief.questionCount, used)
  picked.forEach((q) => used.add(q.id))
  set({ phase: 'DEBRIEF', debriefQuestions: picked, debriefAttempts: [], usedQuestionIds: used })
}

// PRD 4.5 패배 조건: 방파제 내구도 0. 전투 중일 때만 발동시켜 이미 패배/다른 화면으로
// 넘어간 뒤 중복 발동되지 않게 한다.
function checkDefeat(set: SetFn, get: GetFn): boolean {
  const s = get()
  if (s.durability > 0 || s.phase !== 'COMBAT') return false
  set({ phase: 'DEFEAT' })
  return true
}

function resolveCrab(set: SetFn, get: GetFn) {
  const s = get()
  const remaining = Math.max(0, s.crabsRemaining - 1)
  set({ crabsRemaining: remaining })
  tryEnterDebrief(set, get)
}

const PRE_CHECK_SLOTS: { key: PreCheckSlot['key']; label: string }[] = [
  { key: 'barrel', label: '포신 점검' },
  { key: 'loader', label: '장전기 점검' },
  { key: 'breakwater', label: '방파제 점검' },
]

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      phase: 'LOBBY',
      waveNumber: 1,
      durability: balance.combat.breakwaterMaxDurability,
      attackBuffPct: 0,
      fireRateBuffPct: 0,
      score: 0,
    
      parts: 0,
      stagePartsEarned: 0,
      stageAttempts: [],
      rapidStreak: 0,
      readLockMultiplier: 1,

      currentStageId: 1,
      maxStageUnlocked: 1,
      stageClears: {},

      stageStars: null,
      stageGrade: null,
    
      preCheckSlots: PRE_CHECK_SLOTS.map((s) => ({ ...s, answered: false, correct: null })),
      preCheckQuestions: {},
      usedQuestionIds: new Set(),
    
      crabsTotal: 0,
      crabsRemaining: 0,
      crabsDefeated: 0,
    
      debriefQuestions: [],
      debriefAttempts: [],
    
      maintenanceRepairQuestion: null,
      maintenanceRepairDone: false,
      maintenanceBonusQuestion: null,
      maintenanceBonusUsed: 0,
    
      activeSupplyQuestion: null,
      supplyBombardPulse: 0,
      supplyResultText: null,
      supplyResultPulse: 0,
      infiniteReloadUntil: 0,
    
      bossActive: false,
      bossTriggered: false,
      bossDefeated: false,
      bossHp: balance.boss.maxHp,
      bossWeakPointIndex: 0,
      bossExposed: true,
      bossAttackTelegraphed: false,
      bossShellFlying: false,
      bossShellPulse: 0,
      bossExposureBonusSec: 0,
    
      ownedWeapons: [STARTING_WEAPON_ID],
      equippedWeaponId: STARTING_WEAPON_ID,
      weaponLevels: { [STARTING_WEAPON_ID]: 1 },
      pendingUpgrade: null,

      ownedVehicles: [STARTING_VEHICLE_ID],
      equippedVehicleId: STARTING_VEHICLE_ID,
      pendingVehiclePurchase: null,

      goToLobby: () => set({ phase: 'LOBBY' }),

      startStage: (stageId) => {
        const resolvedStageId = stageId ?? get().currentStageId
        set({
          currentStageId: resolvedStageId,
          waveNumber: 1,
          durability: balance.combat.breakwaterMaxDurability,
          attackBuffPct: 0,
          fireRateBuffPct: 0,
          score: 0,
          stagePartsEarned: 0,
          stageAttempts: [],
          rapidStreak: 0,
          readLockMultiplier: 1,
          stageStars: null,
          stageGrade: null,
          usedQuestionIds: new Set(),
          crabsTotal: 0,
          crabsRemaining: 0,
          crabsDefeated: 0,
          debriefAttempts: [],
          activeSupplyQuestion: null,
          supplyBombardPulse: 0,
          supplyResultText: null,
          supplyResultPulse: 0,
          infiniteReloadUntil: 0,
          bossActive: false,
          bossTriggered: false,
          bossDefeated: false,
          bossHp: getEffectiveBossMaxHp(resolvedStageId),
          bossWeakPointIndex: 0,
          bossExposed: true,
          bossAttackTelegraphed: false,
          bossShellFlying: false,
          bossShellPulse: 0,
          bossExposureBonusSec: 0,
        })
        get().beginPreCheck()
      },

      // PRD 4.5: 패배 시 해당 웨이브부터 재시작(출격 점검 다시 수행).
      // waveNumber/score/usedQuestionIds는 유지하고, 이번 스테이지에서 번 부품의 절반만 남긴다.
      retryWave: () => {
        const s = get()
        const lostParts = Math.floor(s.stagePartsEarned / 2)
        set({
          durability: balance.combat.breakwaterMaxDurability,
          attackBuffPct: 0,
          fireRateBuffPct: 0,
          parts: Math.max(0, s.parts - lostParts),
          stagePartsEarned: Math.max(0, s.stagePartsEarned - lostParts),
          crabsTotal: 0,
          crabsRemaining: 0,
          crabsDefeated: 0,
          debriefAttempts: [],
          activeSupplyQuestion: null,
          supplyBombardPulse: 0,
          supplyResultText: null,
          supplyResultPulse: 0,
          infiniteReloadUntil: 0,
          bossActive: false,
          bossTriggered: false,
          bossDefeated: false,
          bossHp: getEffectiveBossMaxHp(s.currentStageId),
          bossWeakPointIndex: 0,
          bossExposed: true,
          bossAttackTelegraphed: false,
          bossShellFlying: false,
          bossShellPulse: 0,
          bossExposureBonusSec: 0,
        })
        get().beginPreCheck()
      },

      beginPreCheck: () => {
        const s = get()
        const used = s.usedQuestionIds
        const picked = pickQuestions(s.currentStageId, balance.preCheckQuestionCount, used)
        const byKey: Record<string, Question> = {}
        PRE_CHECK_SLOTS.forEach((slot, i) => {
          if (picked[i]) byKey[slot.key] = picked[i]
        })
        picked.forEach((q) => used.add(q.id))
        set({
          phase: 'PRE_CHECK',
          preCheckSlots: PRE_CHECK_SLOTS.map((s) => ({ ...s, answered: false, correct: null })),
          preCheckQuestions: byKey,
          usedQuestionIds: used,
        })
      },
    
      answerPreCheck: (slotKey, choice, responseMs) => {
        const state = get()
        const question = state.preCheckQuestions[slotKey]
        if (!question) return
        const correct = choice === question.answer
    
        recordAttempt(set, get, { questionId: question.id, context: 'precheck', choice, correct, responseMs })
    
        const { attackBuffPct: atkDelta, fireRateBuffPct: frDelta, durabilityDelta } = (() => {
          const b = balance.preCheck
          if (slotKey === 'barrel') {
            return { attackBuffPct: correct ? b.attackBuffPct : b.attackDebuffPct, fireRateBuffPct: 0, durabilityDelta: 0 }
          }
          if (slotKey === 'loader') {
            return { attackBuffPct: 0, fireRateBuffPct: correct ? b.fireRateBuffPct : b.fireRateDebuffPct, durabilityDelta: 0 }
          }
          return { attackBuffPct: 0, fireRateBuffPct: 0, durabilityDelta: correct ? b.durabilityBuff : b.durabilityDebuff }
        })()
    
        const afterRecord = get()
        const nextSlots = afterRecord.preCheckSlots.map((slot) =>
          slot.key === slotKey ? { ...slot, answered: true, correct } : slot,
        )
    
        set({
          preCheckSlots: nextSlots,
          attackBuffPct: afterRecord.attackBuffPct + atkDelta,
          fireRateBuffPct: afterRecord.fireRateBuffPct + frDelta,
          durability: Math.max(
            0,
            Math.min(balance.combat.breakwaterMaxDurability, afterRecord.durability + durabilityDelta),
          ),
        })
    
        const allAnswered = nextSlots.every((s) => s.answered)
        if (allAnswered) {
          set({ phase: 'WAVE_INTRO' })
        }
      },
    
      beginWave: () => {
        const s = get()
        const stageDef = getStageDef(s.currentStageId)
        const crabsTotal = stageDef.crabCountsByWave[s.waveNumber - 1]
        const isBossWave = s.waveNumber === stageDef.crabCountsByWave.length
        set({
          phase: 'COMBAT',
          crabsTotal,
          crabsRemaining: crabsTotal,
          crabsDefeated: 0,
          ...(isBossWave
            ? {
                bossActive: false,
                bossDefeated: false,
                bossTriggered: false,
                bossHp: getEffectiveBossMaxHp(s.currentStageId),
                bossWeakPointIndex: 0 as WeakIndex,
                bossExposed: true,
                bossAttackTelegraphed: false,
                bossShellFlying: false,
                bossShellPulse: 0,
                bossExposureBonusSec: 0,
              }
            : {}),
        })
      },
    
      defeatCrab: () => {
        set((s) => ({ score: s.score + balance.score.crabDefeated, crabsDefeated: s.crabsDefeated + 1 }))
        resolveCrab(set, get)
      },
    
      crabReachedBreakwater: () => {
        const next = Math.max(0, get().durability - balance.combat.crabDamageOnHit)
        set({ durability: next })
        if (checkDefeat(set, get)) return
        resolveCrab(set, get)
      },
    
      bossArrived: () => {
        const s = get()
        const isBossWave = s.waveNumber === getStageDef(s.currentStageId).crabCountsByWave.length
        if (!isBossWave || s.bossTriggered || s.bossDefeated) return
        set({ phase: 'BOSS_INTRO', bossTriggered: true })
      },

      finishBossIntro: () => {
        set({ phase: 'COMBAT', bossActive: true })
      },

      getEffectiveAttack: () => getEffectiveAttack(get),

      damageBoss: (targetWeak) => {
        const s = get()
        if (!s.bossActive || s.bossDefeated) return null
        const effectiveAttack = getEffectiveAttack(get)
        const effectiveWeak = targetWeak && s.bossExposed
        const dmg = effectiveAttack * (effectiveWeak ? balance.boss.weakMultiplier : balance.boss.normalMultiplier)
        const nextHp = Math.max(0, s.bossHp - dmg)

        let weakIndex: WeakIndex = s.bossWeakPointIndex
        const pct = nextHp / getEffectiveBossMaxHp(s.currentStageId)
        if (pct <= 0.33) weakIndex = 2
        else if (pct <= 0.66 && weakIndex < 1) weakIndex = 1
    
        const defeated = nextHp <= 0
        set({
          bossHp: nextHp,
          bossWeakPointIndex: weakIndex,
          bossAttackTelegraphed: effectiveWeak ? false : s.bossAttackTelegraphed,
          bossDefeated: defeated,
          score: s.score + (defeated ? balance.boss.defeatScore : effectiveWeak ? balance.boss.weakHitScore : 0),
        })
    
        if (defeated) tryEnterDebrief(set, get)
        return { damage: dmg, critical: effectiveWeak }
      },

      setBossExposed: (exposed) => set({ bossExposed: exposed }),
    
      consumeBossExposureBonus: () => {
        const bonus = get().bossExposureBonusSec
        if (bonus > 0) set({ bossExposureBonusSec: 0 })
        return bonus
      },
    
      telegraphBossAttack: () => {
        const s = get()
        if (!s.bossActive || s.bossDefeated) return
        set({ bossAttackTelegraphed: true })
      },

      // 전조 경고가 끝나면 바로 내구도를 깎는 대신, 실제로 포탄이 날아가는 연출을 Scene.tsx에
      // 맡긴다 — 포탄이 날아가는 동안 플레이어가 맞혀서 격추하면 interceptBossShell(), 못 막고
      // 방파제에 닿으면 resolveBossAttack()이 호출된다.
      launchBossShell: () => {
        const s = get()
        if (!s.bossActive || s.bossDefeated) return
        set({ bossAttackTelegraphed: false, bossShellFlying: true, bossShellPulse: s.bossShellPulse + 1 })
      },

      interceptBossShell: () => {
        const s = get()
        if (!s.bossShellFlying) return
        set({ bossShellFlying: false, score: s.score + balance.boss.shellInterceptScore })
      },

      resolveBossAttack: () => {
        const s = get()
        if (!s.bossShellFlying) return
        const attackDamage = balance.boss.attackDamage * getStageDef(s.currentStageId).bossDamageMultiplier
        set({
          bossShellFlying: false,
          durability: Math.max(0, s.durability - attackDamage),
        })
        checkDefeat(set, get)
      },

      // 질문을 못 띄우면(이미 다른 문제가 떠 있거나, 낼 문제가 없음) false를 돌려준다 — 호출부
      // (Scene.tsx)가 이 값을 보고서야 상자를 치운다. 예전엔 무조건 상자부터 치웠는데, 그러면
      // "맞혔는데 문제가 안 뜨고 상자만 사라지는" 버그로 보였다.
      openSupplyBox: (boxType) => {
        const s = get()
        if (s.activeSupplyQuestion) return false
        const used = s.usedQuestionIds
        const [q] = pickQuestions(s.currentStageId, 1, used)
        if (!q) return false
        used.add(q.id)
        set({ activeSupplyQuestion: { boxType, question: q }, usedQuestionIds: used })
        return true
      },
    
      answerSupplyBox: (choice, responseMs) => {
        const s = get()
        const active = s.activeSupplyQuestion
        if (!active) return
        const correct = choice === active.question.answer
        recordAttempt(set, get, {
          questionId: active.question.id,
          context: 'supply',
          choice,
          correct,
          responseMs,
        })
    
        // 맞혀서 실제로 뭘 얻었는지 화면에 띄울 문구 — 보상 종류별로 분기해서 채운다.
        let resultText: string | null = null
        if (correct) {
          const b = balance.supplyBox
          if (active.boxType === 'parts') {
            set((st) => ({ parts: st.parts + b.partsReward, stagePartsEarned: st.stagePartsEarned + b.partsReward }))
            resultText = `부품 +${b.partsReward}`
          } else if (active.boxType === 'repair') {
            if (Math.random() < 0.5) {
              set((st) => ({
                durability: Math.min(balance.combat.breakwaterMaxDurability, st.durability + b.repairDurability),
              }))
              resultText = `방파제 내구도 +${b.repairDurability}`
            } else {
              set({ infiniteReloadUntil: Date.now() + b.infiniteReloadSec * 1000 })
              resultText = `무한 장전 (${b.infiniteReloadSec}초)`
            }
          } else if (active.boxType === 'bombard') {
            set((st) => ({ supplyBombardPulse: st.supplyBombardPulse + 1 }))
            resultText = '공중 포격 지원!'
            const st2 = get()
            if (st2.bossActive && !st2.bossDefeated) {
              const dmg = getEffectiveBossMaxHp(st2.currentStageId) * b.bombardBossDamagePct
              const nextHp = Math.max(0, st2.bossHp - dmg)
              const defeated = nextHp <= 0
              set({
                bossHp: nextHp,
                bossDefeated: defeated,
                bossExposed: true,
                bossExposureBonusSec: st2.bossExposureBonusSec + b.bombardWeakExposureBonusSec,
              })
              if (defeated) tryEnterDebrief(set, get)
            }
          }
        }

        set((st) => ({
          activeSupplyQuestion: null,
          supplyResultText: resultText,
          supplyResultPulse: resultText ? st.supplyResultPulse + 1 : st.supplyResultPulse,
        }))
      },
    
      answerDebrief: (choice, responseMs) => {
        const state = get()
        const q = state.debriefQuestions[state.debriefAttempts.length]
        if (!q) return
        const correct = choice === q.answer
        const attempt: Attempt = {
          questionId: q.id,
          context: 'debrief',
          choice,
          correct,
          responseMs,
          createdAt: Date.now(),
        }
        const attempts = [...state.debriefAttempts, attempt]
        set({ debriefAttempts: attempts })
        recordAttempt(set, get, { questionId: q.id, context: 'debrief', choice, correct, responseMs })
    
        if (attempts.length >= balance.debrief.questionCount && get().canEnterMaintenance()) {
          const afterAnswer = get()
          const used = afterAnswer.usedQuestionIds
          const [repairQ] = pickQuestions(afterAnswer.currentStageId, 1, used)
          if (repairQ) used.add(repairQ.id)
          const [bonusQ] = pickQuestions(afterAnswer.currentStageId, 1, used)
          if (bonusQ) used.add(bonusQ.id)
          set({
            phase: 'MAINTENANCE',
            usedQuestionIds: used,
            maintenanceRepairQuestion: repairQ ?? null,
            maintenanceRepairDone: false,
            maintenanceBonusQuestion: bonusQ ?? null,
            maintenanceBonusUsed: 0,
          })
        }
      },
    
      answerMaintenanceRepair: (choice, responseMs) => {
        const state = get()
        const q = state.maintenanceRepairQuestion
        if (!q || state.maintenanceRepairDone) return
        const correct = choice === q.answer
        recordAttempt(set, get, { questionId: q.id, context: 'maintenance', choice, correct, responseMs })
        set((st) => ({
          maintenanceRepairDone: true,
          durability: correct
            ? Math.min(balance.combat.breakwaterMaxDurability, st.durability + balance.maintenance.repairDurability)
            : st.durability,
        }))
      },
    
      answerMaintenanceBonus: (choice, responseMs) => {
        const state = get()
        const q = state.maintenanceBonusQuestion
        if (!q || state.maintenanceBonusUsed >= balance.maintenance.bonusMaxAttempts) return
        const correct = choice === q.answer
        recordAttempt(set, get, { questionId: q.id, context: 'maintenance', choice, correct, responseMs })
    
        const after = get()
        const used = after.usedQuestionIds
        const nextUsed = after.maintenanceBonusUsed + 1
        const reward = correct ? balance.maintenance.bonusPartsReward[after.maintenanceBonusUsed] ?? 0 : 0
        const [nextBonusQ] =
          nextUsed < balance.maintenance.bonusMaxAttempts ? pickQuestions(after.currentStageId, 1, used) : []
        if (nextBonusQ) used.add(nextBonusQ.id)
        set({
          maintenanceBonusUsed: nextUsed,
          maintenanceBonusQuestion: nextBonusQ ?? null,
          usedQuestionIds: used,
          parts: after.parts + reward,
          stagePartsEarned: after.stagePartsEarned + reward,
        })
      },
    
      finishMaintenance: () => {
        const s = get()
        const stageDef = getStageDef(s.currentStageId)
        if (s.waveNumber < stageDef.crabCountsByWave.length) {
          set({ waveNumber: s.waveNumber + 1 })
          get().beginPreCheck()
          return
        }

        const grade = computeDiligenceGrade(s.stageAttempts)
        const durabilityPct = s.durability / balance.combat.breakwaterMaxDurability
        const stars = computeStars(grade, durabilityPct)
        const clearBonus = balance.hangar.clearBonusPerStar * stars

        const unlock = stageDef.clearUnlock
        const ownedWeapons =
          unlock?.weaponId && !s.ownedWeapons.includes(unlock.weaponId)
            ? [...s.ownedWeapons, unlock.weaponId]
            : s.ownedWeapons
        const ownedVehicles =
          unlock?.vehicleId && !s.ownedVehicles.includes(unlock.vehicleId)
            ? [...s.ownedVehicles, unlock.vehicleId]
            : s.ownedVehicles
        const weaponLevels = unlock?.weaponId
          ? { ...s.weaponLevels, [unlock.weaponId]: s.weaponLevels[unlock.weaponId] ?? 1 }
          : s.weaponLevels

        set({
          phase: 'STAGE_RESULT',
          parts: s.parts + clearBonus,
          stagePartsEarned: s.stagePartsEarned + clearBonus,
          stageStars: stars,
          stageGrade: grade,
          ownedWeapons,
          ownedVehicles,
          weaponLevels,
          maxStageUnlocked: Math.min(STAGE_DEFS.length, Math.max(s.maxStageUnlocked, s.currentStageId + 1)),
          stageClears: { ...s.stageClears, [s.currentStageId]: { stars, grade } },
        })
      },
    
      goToHangar: () => set({ phase: 'HANGAR' }),
    
      equipWeapon: (weaponId) => {
        const s = get()
        if (!s.ownedWeapons.includes(weaponId)) return
        set({ equippedWeaponId: weaponId })
      },

      equipVehicle: (vehicleId) => {
        const s = get()
        if (!s.ownedVehicles.includes(vehicleId)) return
        set({ equippedVehicleId: vehicleId })
      },

      requestUpgrade: (weaponId) => {
        const s = get()
        const level = s.weaponLevels[weaponId] ?? 1
        if (level >= balance.hangar.maxLevel) return
        const nextLevel = level + 1
        const cost = balance.hangar.upgradeCostPerLevel * level
        if (s.parts < cost) return
    
        if (nextLevel >= balance.hangar.upgradeQuestionGateLevel) {
          const used = s.usedQuestionIds
          const [q] = pickQuestions(s.currentStageId, 1, used)
          if (!q) return
          used.add(q.id)
          set({
            parts: s.parts - cost,
            usedQuestionIds: used,
            pendingUpgrade: { weaponId, nextLevel, escrowedParts: cost, question: q },
          })
        } else {
          set({
            parts: s.parts - cost,
            weaponLevels: { ...s.weaponLevels, [weaponId]: nextLevel },
          })
        }
      },
    
      answerUpgrade: (choice, responseMs) => {
        const s = get()
        const p = s.pendingUpgrade
        if (!p) return
        const correct = choice === p.question.answer
        recordAttempt(set, get, { questionId: p.question.id, context: 'upgrade', choice, correct, responseMs })
    
        if (correct) {
          set((st) => ({
            weaponLevels: { ...st.weaponLevels, [p.weaponId]: p.nextLevel },
            pendingUpgrade: null,
          }))
        } else {
          set((st) => ({ parts: st.parts + p.escrowedParts, pendingUpgrade: null }))
        }
      },

      // 스테이지 클리어 해금과 별개로, 격납고에서 부품으로 바로 사는 기체(레드 썬더 Mk.II).
      // 무기 강화(requestUpgrade)와 같은 패턴 — 비용을 먼저 떼어 escrow하고 문제를 맞혀야
      // 확정되며, 틀리면 부품을 돌려준다.
      requestVehiclePurchase: (vehicleId) => {
        const s = get()
        if (s.ownedVehicles.includes(vehicleId) || s.pendingVehiclePurchase) return
        const cost = VEHICLE_DEFS[vehicleId]?.purchaseCost
        if (!cost || s.parts < cost) return
        const used = s.usedQuestionIds
        const [q] = pickQuestions(s.currentStageId, 1, used)
        if (!q) return
        used.add(q.id)
        set({
          parts: s.parts - cost,
          usedQuestionIds: used,
          pendingVehiclePurchase: { vehicleId, escrowedParts: cost, question: q },
        })
      },

      answerVehiclePurchase: (choice, responseMs) => {
        const s = get()
        const p = s.pendingVehiclePurchase
        if (!p) return
        const correct = choice === p.question.answer
        recordAttempt(set, get, { questionId: p.question.id, context: 'upgrade', choice, correct, responseMs })

        if (correct) {
          set((st) => ({
            ownedVehicles: st.ownedVehicles.includes(p.vehicleId) ? st.ownedVehicles : [...st.ownedVehicles, p.vehicleId],
            pendingVehiclePurchase: null,
          }))
        } else {
          set((st) => ({ parts: st.parts + p.escrowedParts, pendingVehiclePurchase: null }))
        }
      },

      canEnterDebrief: () => {
        const s = get()
        if (s.phase !== 'COMBAT') return false
        if (s.crabsRemaining !== 0) return false
        const isBossWave = s.waveNumber === getStageDef(s.currentStageId).crabCountsByWave.length
        if (isBossWave && !s.bossDefeated) return false
        return true
      },
      canEnterMaintenance: () =>
        get().phase === 'DEBRIEF' && get().debriefAttempts.length >= balance.debrief.questionCount,
    }),
    {
      name: 'bangpaje-defense-save',
      storage: createJSONStorage(() => idbStorage, {
        replacer: (_key, value) => (value instanceof Set ? { __set: Array.from(value) } : value),
        reviver: (_key, value) =>
          value && typeof value === 'object' && '__set' in (value as Record<string, unknown>)
            ? new Set((value as { __set: string[] }).__set)
            : value,
      }),
      version: 1,
    },
  ),
)
