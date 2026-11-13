import { balance } from '../config/balance'
import type { MobKind } from '../types'
import { STAGE1_CLEAR_UNLOCK_WEAPON_ID } from './weapons'

export interface StageClearUnlock {
  weaponId?: string
  vehicleId?: string
}

// 스테이지별 보스 모델. 산호 거신(스테이지 1)은 기존 저폴리 모델, 해파리 대왕/빙하 거신은
// SeaMobs_GameAssets에서 따로 제작해 온 걸 그대로 가져왔다 — 모델마다 약점 메시 이름이
// 다를 수 있어 weakNames로 보스별로 지정한다(머리→가슴→등 진행 순서, Boss.tsx가 그대로 읽음).
export interface BossAsset {
  modelUrl: string
  displayName: string
  scale: number
  // 파도 높이에 얼마나 묻히는지(아래로 내림) — 공중에 뜬 보스는 0 또는 음수를 쓴다.
  sink: number
  // 파도에 의한 상하 움직임을 얼마나 받을지(1=그대로, 0=전혀 안 받음). 해파리 대왕처럼
  // 공중에 떠 있는 보스는 살짝만 출렁이도록 낮게 잡는다.
  waveInfluence: number
  weakNames: readonly [string, string, string]
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
  bossAsset: BossAsset
  clearUnlock?: StageClearUnlock
}

// 스테이지 2는 "같은 분수 단원, 같은 몹 구성"을 유지하되 숫자만 올려 난이도를 높인다
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
    bossAsset: {
      modelUrl: '/assets/boss-volcano-titan.glb',
      displayName: '산호 거신',
      scale: 0.5,
      sink: 0.15,
      waveInfluence: 1,
      weakNames: ['Head', 'Core_Torso', 'Back_Upper'],
    },
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
    bossAsset: {
      modelUrl: '/assets/boss-jelly-king.glb',
      displayName: '해파리 대왕',
      // 모델 자체가 실제 미터 단위(높이 약 17m)로 나와서 배율 보정이 필요 없다.
      scale: 1,
      // 공중에 떠 있는 보스라 가라앉히지 않고, 파도의 영향도 살짝만 받게 한다(SeaMobs 가이드).
      sink: 0,
      waveInfluence: 0.3,
      weakNames: ['Jelly_Crown', 'Jelly_Core', 'Jelly_Bell'],
    },
    // vehicles.ts에 이미 "스테이지 2 클리어 필요"로 잠겨 있던 기체.
    clearUnlock: { vehicleId: 'yellow_ranger' },
  },
]

// 스테이지 3 대비로 미리 받아둔 보스 — 아직 어느 스테이지에도 연결돼 있지 않다.
// 스테이지 3을 만들 때 STAGE_DEFS에 bossAsset: RESERVED_BOSS_ASSETS.glacierTitan 으로 꽂으면 된다.
export const RESERVED_BOSS_ASSETS = {
  glacierTitan: {
    modelUrl: '/assets/boss-glacier-titan.glb',
    displayName: '빙하 거신',
    scale: 1,
    sink: 2.5,
    waveInfluence: 1,
    // 원본 파일의 약점 메시 이름 — Head는 내보낼 때 이름이 충돌해 'Head.001'로 저장돼 있다
    // (파일은 건드리지 않고 실제 있는 이름을 그대로 참조).
    weakNames: ['Head.001', 'Core_Heart', 'Back'],
  } satisfies BossAsset,
}

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
