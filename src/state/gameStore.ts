import { create } from 'zustand'
import { balance } from '../config/balance'
import { STARTING_WEAPON_ID, STAGE1_CLEAR_UNLOCK_WEAPON_ID, WEAPON_DEFS } from '../data/weapons'
import { computeDiligenceGrade, computeStars } from './diligence'
import type {
  ActiveSupplyQuestion,
  Attempt,
  DiligenceGrade,
  GamePhase,
  PendingUpgrade,
  PreCheckSlot,
  Question,
  QuestionContext,
  SupplyBoxType,
} from '../types'
import questionsData from '../data/questions/math-g3-s1-sample.json'

const questions = questionsData as Question[]
type WeakIndex = 0 | 1 | 2

function pickQuestions(count: number, excludeIds: Set<string>): Question[] {
  const pool = questions.filter((q) => !excludeIds.has(q.id))
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

  bossActive: boolean
  bossTriggered: boolean
  bossDefeated: boolean
  bossHp: number
  bossWeakPointIndex: WeakIndex
  bossExposed: boolean
  bossAttackTelegraphed: boolean
  bossExposureBonusSec: number

  ownedWeapons: string[]
  equippedWeaponId: string
  weaponLevels: Record<string, number>
  pendingUpgrade: PendingUpgrade | null

  // --- actions ---
  startStage: () => void
  beginPreCheck: () => void
  answerPreCheck: (slotKey: PreCheckSlot['key'], choice: number, responseMs: number) => void

  beginWave: () => void
  defeatCrab: () => void
  crabReachedBreakwater: () => void

  finishBossIntro: () => void
  damageBoss: (targetWeak: boolean) => void
  setBossExposed: (exposed: boolean) => void
  consumeBossExposureBonus: () => number
  telegraphBossAttack: () => void
  resolveBossAttack: () => void

  openSupplyBox: (boxType: SupplyBoxType) => void
  answerSupplyBox: (choice: number, responseMs: number) => void

  answerDebrief: (choice: number, responseMs: number) => void

  answerMaintenanceRepair: (choice: number, responseMs: number) => void
  answerMaintenanceBonus: (choice: number, responseMs: number) => void
  finishMaintenance: () => void

  goToHangar: () => void
  equipWeapon: (weaponId: string) => void
  requestUpgrade: (weaponId: string) => void
  answerUpgrade: (choice: number, responseMs: number) => void

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

function tryEnterDebrief(set: SetFn, get: GetFn) {
  if (!get().canEnterDebrief()) return
  const used = get().usedQuestionIds
  const picked = pickQuestions(balance.debrief.questionCount, used)
  picked.forEach((q) => used.add(q.id))
  set({ phase: 'DEBRIEF', debriefQuestions: picked, debriefAttempts: [], usedQuestionIds: used })
}

function resolveCrab(set: SetFn, get: GetFn) {
  const s = get()
  const remaining = Math.max(0, s.crabsRemaining - 1)
  set({ crabsRemaining: remaining })

  if (s.waveNumber === 3 && !s.bossTriggered) {
    const threshold = Math.ceil(s.crabsTotal * balance.boss.triggerMobRatio)
    if (remaining <= threshold) {
      set({ phase: 'BOSS_INTRO', bossTriggered: true })
      return
    }
  }
  tryEnterDebrief(set, get)
}

const PRE_CHECK_SLOTS: { key: PreCheckSlot['key']; label: string }[] = [
  { key: 'barrel', label: '포신 점검' },
  { key: 'loader', label: '장전기 점검' },
  { key: 'breakwater', label: '방파제 점검' },
]

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'PRE_CHECK',
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
  infiniteReloadUntil: 0,

  bossActive: false,
  bossTriggered: false,
  bossDefeated: false,
  bossHp: balance.boss.maxHp,
  bossWeakPointIndex: 0,
  bossExposed: true,
  bossAttackTelegraphed: false,
  bossExposureBonusSec: 0,

  ownedWeapons: [STARTING_WEAPON_ID],
  equippedWeaponId: STARTING_WEAPON_ID,
  weaponLevels: { [STARTING_WEAPON_ID]: 1 },
  pendingUpgrade: null,

  startStage: () => {
    set({
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
      infiniteReloadUntil: 0,
      bossActive: false,
      bossTriggered: false,
      bossDefeated: false,
      bossHp: balance.boss.maxHp,
      bossWeakPointIndex: 0,
      bossExposed: true,
      bossAttackTelegraphed: false,
      bossExposureBonusSec: 0,
    })
    get().beginPreCheck()
  },

  beginPreCheck: () => {
    const used = get().usedQuestionIds
    const picked = pickQuestions(balance.preCheckQuestionCount, used)
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
    const crabsTotal = balance.wave.crabCountsByWave[s.waveNumber - 1]
    const isBossWave = s.waveNumber === 3
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
            bossHp: balance.boss.maxHp,
            bossWeakPointIndex: 0 as WeakIndex,
            bossExposed: true,
            bossAttackTelegraphed: false,
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
    resolveCrab(set, get)
  },

  finishBossIntro: () => {
    set({ phase: 'COMBAT', bossActive: true })
  },

  damageBoss: (targetWeak) => {
    const s = get()
    if (!s.bossActive || s.bossDefeated) return
    const weapon = WEAPON_DEFS[s.equippedWeaponId]
    const level = s.weaponLevels[s.equippedWeaponId] ?? 1
    const effectiveAttack =
      weapon.baseAttack * (1 + balance.hangar.attackPctPerLevel * (level - 1)) * (1 + s.attackBuffPct)
    const effectiveWeak = targetWeak && s.bossExposed
    const dmg = effectiveAttack * (effectiveWeak ? balance.boss.weakMultiplier : balance.boss.normalMultiplier)
    const nextHp = Math.max(0, s.bossHp - dmg)

    let weakIndex: WeakIndex = s.bossWeakPointIndex
    const pct = nextHp / balance.boss.maxHp
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

  resolveBossAttack: () => {
    const s = get()
    if (!s.bossAttackTelegraphed) return
    set({
      bossAttackTelegraphed: false,
      durability: Math.max(0, s.durability - balance.boss.attackDamage),
    })
  },

  openSupplyBox: (boxType) => {
    const s = get()
    if (s.activeSupplyQuestion) return
    const used = s.usedQuestionIds
    const [q] = pickQuestions(1, used)
    if (!q) return
    used.add(q.id)
    set({ activeSupplyQuestion: { boxType, question: q }, usedQuestionIds: used })
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

    if (correct) {
      const b = balance.supplyBox
      if (active.boxType === 'parts') {
        set((st) => ({ parts: st.parts + b.partsReward, stagePartsEarned: st.stagePartsEarned + b.partsReward }))
      } else if (active.boxType === 'repair') {
        if (Math.random() < 0.5) {
          set((st) => ({
            durability: Math.min(balance.combat.breakwaterMaxDurability, st.durability + b.repairDurability),
          }))
        } else {
          set({ infiniteReloadUntil: Date.now() + b.infiniteReloadSec * 1000 })
        }
      } else if (active.boxType === 'bombard') {
        set((st) => ({ supplyBombardPulse: st.supplyBombardPulse + 1 }))
        const st2 = get()
        if (st2.bossActive && !st2.bossDefeated) {
          const dmg = balance.boss.maxHp * b.bombardBossDamagePct
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

    set({ activeSupplyQuestion: null })
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
      const used = get().usedQuestionIds
      const [repairQ] = pickQuestions(1, used)
      if (repairQ) used.add(repairQ.id)
      const [bonusQ] = pickQuestions(1, used)
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
      nextUsed < balance.maintenance.bonusMaxAttempts ? pickQuestions(1, used) : []
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
    if (s.waveNumber < 3) {
      set({ waveNumber: s.waveNumber + 1 })
      get().beginPreCheck()
      return
    }

    const grade = computeDiligenceGrade(s.stageAttempts)
    const durabilityPct = s.durability / balance.combat.breakwaterMaxDurability
    const stars = computeStars(grade, durabilityPct)
    const clearBonus = balance.hangar.clearBonusPerStar * stars
    const ownedWeapons = s.ownedWeapons.includes(STAGE1_CLEAR_UNLOCK_WEAPON_ID)
      ? s.ownedWeapons
      : [...s.ownedWeapons, STAGE1_CLEAR_UNLOCK_WEAPON_ID]

    set({
      phase: 'STAGE_RESULT',
      parts: s.parts + clearBonus,
      stagePartsEarned: s.stagePartsEarned + clearBonus,
      stageStars: stars,
      stageGrade: grade,
      ownedWeapons,
      weaponLevels: { ...s.weaponLevels, [STAGE1_CLEAR_UNLOCK_WEAPON_ID]: s.weaponLevels[STAGE1_CLEAR_UNLOCK_WEAPON_ID] ?? 1 },
    })
  },

  goToHangar: () => set({ phase: 'HANGAR' }),

  equipWeapon: (weaponId) => {
    const s = get()
    if (!s.ownedWeapons.includes(weaponId)) return
    set({ equippedWeaponId: weaponId })
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
      const [q] = pickQuestions(1, used)
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

  canEnterDebrief: () => {
    const s = get()
    if (s.phase !== 'COMBAT') return false
    if (s.crabsRemaining !== 0) return false
    if (s.waveNumber === 3 && !s.bossDefeated) return false
    return true
  },
  canEnterMaintenance: () =>
    get().phase === 'DEBRIEF' && get().debriefAttempts.length >= balance.debrief.questionCount,
}))
