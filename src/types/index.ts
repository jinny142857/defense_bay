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
  | 'LOBBY'
  | 'PRE_CHECK'
  | 'WAVE_INTRO'
  | 'BOSS_INTRO'
  | 'COMBAT'
  | 'DEFEAT'
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

// PRD 4.4 몹 종류 (M2에서는 꼬마 게 / 개구리-거북이형 몬스터 2종)
export type MobKind = 'crab' | 'frogTurtle'

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

// 기체별 3D 렌더링 정보 — Turret.tsx가 이걸 보고 어떤 전차 모델을 어떻게 띄울지 결정한다.
// 지정하지 않은 기체는 vehicles.ts의 DEFAULT_VEHICLE_RENDER(기존 파란 전차)를 그대로 쓴다.
export interface VehicleRenderAsset {
  modelUrl: string
  scale: number
  // 모델 정면(로컬 +X)을 게임 전방(-Z)에 맞추는 보정 회전.
  wrapperRotationY: number
  // 발사 시 Barrel_Recoil이 뒤로 밀리는 거리(모델 로컬 단위, Tank_Root 하위 계층 기준).
  recoilDistance: number
  // 지정하면 기존 평면 예광탄 대신 이 포탄 모델이 포구→명중 지점으로 실제로 날아간다.
  shellModelUrl?: string
}

export interface VehicleDef {
  id: string
  name: string
  // 잠긴 기체 카드에 보여줄 해금 조건 설명 (스테이지 클리어로 해금되는 기체용. 실제 해금은
  // data/stages.ts의 clearUnlock이 처리)
  unlockHint: string
  render?: VehicleRenderAsset
  // 지정하면 격납고에서 부품으로 직접 구매할 수 있다(스테이지 클리어 해금과는 별개 경로).
  purchaseCost?: number
  // 장착 시 무기 공격력/발사속도에 곱해지는 보너스(0.15 = +15%). 레드 썬더 Mk.II 전용.
  attackPct?: number
  fireRatePct?: number
}

export interface PendingUpgrade {
  weaponId: string
  nextLevel: number
  escrowedParts: number
  question: Question
}

export interface PendingVehiclePurchase {
  vehicleId: string
  escrowedParts: number
  question: Question
}
