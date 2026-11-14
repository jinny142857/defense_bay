// 포구(Muzzle_Point)의 실시간 월드 좌표 공유용 신호 — aimSignal/fireSignal과 같은 패턴.
// Turret.tsx가 매 프레임 갱신하고, Scene.tsx가 예광탄/포구 화염 위치를 여기서 읽는다.
// 장착 기체에 따라 전차 모델 크기(포신 길이)가 달라지므로, 더 이상 고정 좌표를 쓰지 않는다.
export const muzzleSignal = {
  x: 0,
  y: 1.63,
  z: -8.3,
}
