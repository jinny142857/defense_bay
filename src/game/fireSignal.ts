// 발사 반동/머즐플래시 트리거용 공유 신호. 순수 시각 효과라 zustand 전역 상태 대신
// 프레임마다 폴링하는 카운터로 둔다 (Scene.tsx가 증가, Turret.tsx가 변화를 감지).
export const fireSignal = { seq: 0 }

export function triggerFireSignal() {
  fireSignal.seq += 1
}
