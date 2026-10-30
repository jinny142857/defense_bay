// PRD 9.4(데이터 모델) / 8.1(문제 스키마)의 M1~M2 부분집합

export type QuestionContext = 'precheck' | 'debrief' | 'maintenance' | 'supply' | 'upgrade'

export interface Question {
  id: string
  grade: number
  semester: number
  subject: string
  unit: string
  concept: string
  difficulty: number
  type: 'multiple_choice'
  stem: string
  choices: string[]
  answer: number
  explanation: string
  variantOf?: string
  minReadSec: number
}

export interface Attempt {
  questionId: string
  context: QuestionContext
  choice: number
  correct: boolean
  responseMs: number
  createdAt: number
}

// PRD 9.3: LOADING -> LOBBY -> STAGE_SELECT -> PRE_CHECK -> WAVE_INTRO -> COMBAT
//          -> (보스 웨이브: BOSS_INTRO -> COMBAT) -> DEBRIEF -> MAINTENANCE
//          -> (다음 웨이브 | STAGE_RESULT) -> HANGAR
// M1~M2에서는 LOBBY/STAGE_SELECT를 생략하고 스테이지 1(3웨이브)만 다룬다.
export type GamePhase =
  | 'PRE_CHECK'
  | 'WAVE_INTRO'
  | 'BOSS_INTRO'
  | 'COMBAT'
  | 'DEBRIEF'
  | 'MAINTENANCE'
  | 'STAGE_RESULT'
  | 'HANGAR'

export interface PreCheckSlot {
  key: 'barrel' | 'loader' | 'breakwater'
  label: string
  answered: boolean
  correct: boolean | null
}

// PRD 3.3 보급상자
export type SupplyBoxType = 'parts' | 'bombard' | 'repair'

export interface ActiveSupplyQuestion {
  boxType: SupplyBoxType
  question: Question
}

// PRD 3.6-4 성실도 등급
export type DiligenceGrade = 'S' | 'A' | 'B' | 'C'

// PRD 6 격납고
export interface WeaponDef {
  id: string
  name: string
  baseAttack: number
  baseFireRate: number
}

export interface PendingUpgrade {
  weaponId: string
  nextLevel: number
  escrowedParts: number
  question: Question
}
