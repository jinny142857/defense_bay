// 실시간 조준 상태 공유용 신호. 2D HUD 크로스헤어는 R3F Canvas 밖에 있어 zustand reactive
// state 대신 매 프레임 갱신되는 평범한 객체로 공유한다 (fireSignal.ts와 동일한 패턴).
export const aimSignal = {
  visible: false,
  screenX: 0.5, // 0~1, 캔버스 기준 정규화 좌표
  screenY: 0.5,
  hit: false, // true면 지금 조준 중인 지점에서 발사 시 몹/보스/보급상자에 명중
  distanceM: 0,
}
