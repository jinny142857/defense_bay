import { balance } from '../config/balance'
import type { MobKind } from '../types'
import { STAGE1_CLEAR_UNLOCK_WEAPON_ID } from './weapons'

export interface StageClearUnlock {
  weaponId?: string
  vehicleId?: string
}

export interface StageDef {
  id: number
  label: string
  // PRD 4.3처럼 "웨이브별 일반 몹 수" — 배열 길이가 그 스테이지의 웨이브 수이고, 마지막 웨이브가 보스전이다.
  crabCountsByWave: readonly number[]
  mobHpMultiplier: number
  mobSpeedMultiplier: number
  bossHpMultiplier: number
  bossDamageMultiplier: number
  clearUnlock?: StageClearUnlock
}

// 스테이지 2는 "같은 분수 단원, 같은 몹/보스 구성"을 유지하되 숫자만 올려 난이도를 높인다
// (기획 결정: 몹 수/체력/속도와 보스 체력/공격력을 스테이지 1보다 더 세게 잡는다).
export const STAGE_DEFS: StageDef[] = [
  {
    id: 1,
    label: '스테이지 1 · 방파제 방어',
    crabCountsByWave: balance.wave.crabCountsByWave,
    mobHpMultiplier: 1,
    mobSpeedMultiplier: 1,
    bossHpMultiplier: 1,
    bossDamageMultiplier: 1,
    clearUnlock: { weaponId: STAGE1_CLEAR_UNLOCK_WEAPON_ID },
  },
  {
    id: 2,
    label: '스테이지 2 · 거센 파도',
    crabCountsByWave: [16, 20, 26],
    mobHpMultiplier: 1.25,
    mobSpeedMultiplier: 1.12,
    bossHpMultiplier: 1.35,
    bossDamageMultiplier: 1.2,
    // vehicles.ts에 이미 "스테이지 2 클리어 필요"로 잠겨 있던 기체.
    clearUnlock: { vehicleId: 'yellow_ranger' },
  },
]

export function getStageDef(stageId: number): StageDef {
  return STAGE_DEFS[stageId - 1] ?? STAGE_DEFS[0]
}

export function getEffectiveBossMaxHp(stageId: number): number {
  return balance.boss.maxHp * getStageDef(stageId).bossHpMultiplier
}

export function getScaledMobStats(kind: MobKind, stageId: number) {
  const base = balance.mobs[kind]
  const stage = getStageDef(stageId)
  return {
    speed: base.speed * stage.mobSpeedMultiplier,
    sink: base.sink,
    scale: base.scale,
    hp: Math.round(base.hp * stage.mobHpMultiplier),
  }
}
