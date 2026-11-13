import type { VehicleDef } from '../types'

// PRD 6.2 격납고 해금 규칙. 스테이지 2까지만 구현돼 있어 black_titan은 아직
// 잠금 상태로만 노출한다(스테이지 5가 생기면 그때 stages.ts clearUnlock에 연결).
export const VEHICLE_DEFS: Record<string, VehicleDef> = {
  red_hornet: { id: 'red_hornet', name: '레드 호넷', unlockHint: '시작 기체' },
  yellow_ranger: { id: 'yellow_ranger', name: '옐로 레인저', unlockHint: '스테이지 2 클리어 필요' },
  black_titan: { id: 'black_titan', name: '블랙 타이탄', unlockHint: '스테이지 5 클리어 필요' },
}

export const STARTING_VEHICLE_ID = 'red_hornet'
