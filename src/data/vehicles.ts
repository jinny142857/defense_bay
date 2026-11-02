import type { VehicleDef } from '../types'

// PRD 6.2 격납고 해금 규칙. v1은 스테이지 1(3웨이브)까지만 다루므로
// 스테이지 2 이후 클리어로 풀리는 기체는 잠금 상태로만 노출한다.
export const VEHICLE_DEFS: Record<string, VehicleDef> = {
  red_hornet: { id: 'red_hornet', name: '레드 호넷', unlockHint: '시작 기체' },
  yellow_ranger: { id: 'yellow_ranger', name: '옐로 레인저', unlockHint: '스테이지 2 클리어 필요' },
  black_titan: { id: 'black_titan', name: '블랙 타이탄', unlockHint: '스테이지 5 클리어 필요' },
}

export const STARTING_VEHICLE_ID = 'red_hornet'
