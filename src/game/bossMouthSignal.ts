// 보스 약점(머리) 메시의 실시간 월드 좌표 공유용 신호 — muzzleSignal과 같은 패턴.
// Boss.tsx가 매 프레임 갱신하고, Scene.tsx가 보스 포탄(BossShell) 발사 지점을 여기서 읽는다.
// 보스마다 키 차이가 커서(산호 거신 ~10m, 해파리 대왕 ~17m) 고정 좌표 대신 실제 메시 위치를 쓴다.
export const bossMouthSignal = {
  x: 0,
  y: 9,
  z: -22,
}
