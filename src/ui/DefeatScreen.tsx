import { useGameStore } from '../state/gameStore'

// PRD 4.5 패배 화면: 방파제 내구도 0. '다시 도전'은 해당 웨이브부터 재시작(출격 점검 다시 수행),
// 획득한 부품의 50%는 유지된다.
export function DefeatScreen() {
  const waveNumber = useGameStore((s) => s.waveNumber)
  const score = useGameStore((s) => s.score)
  const retryWave = useGameStore((s) => s.retryWave)
  const goToLobby = useGameStore((s) => s.goToLobby)

  return (
    <div className="screen screen--defeat">
      <h1>방파제 함락</h1>
      <p className="screen__subtitle">WAVE {waveNumber}에서 방파제 내구도가 모두 소진됐습니다.</p>
      <p className="defeat__note">점수 {score} · 획득한 부품의 절반은 그대로 남습니다.</p>
      <div className="defeat__actions">
        <button className="defeat__retry" onClick={retryWave}>
          다시 도전
        </button>
        <button className="defeat__lobby" onClick={goToLobby}>
          출격 준비로
        </button>
      </div>
    </div>
  )
}
