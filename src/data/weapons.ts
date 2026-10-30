import type { WeaponDef } from '../types'

// PRD 6.2 격납고 해금 규칙
export const WEAPON_DEFS: Record<string, WeaponDef> = {
  high_explosive: { id: 'high_explosive', name: '고폭 포탄', baseAttack: 64, baseFireRate: 1.1 },
  rapid_cannon: { id: 'rapid_cannon', name: '연사 기관포', baseAttack: 40, baseFireRate: 2.2 },
}

export const STARTING_WEAPON_ID = 'high_explosive'
export const STAGE1_CLEAR_UNLOCK_WEAPON_ID = 'rapid_cannon'
