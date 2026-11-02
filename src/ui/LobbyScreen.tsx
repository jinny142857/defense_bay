import { useGameStore } from '../state/gameStore'

// PRD 2장 출격 준비: 모드 카드 3장(방파제 방어 / 업그레이드 / 협동 출격).
// v1은 스테이지 1만 다루므로 스테이지 선택 화면 없이 '방파제 방어'가 바로 스테이지 1을 시작한다.
// 협동 출격은 PRD 1.4에 따라 진입점만 '준비 중'으로 노출한다.
export function LobbyScreen() {
  const parts = useGameStore((s) => s.parts)
  const startStage = useGameStore((s) => s.startStage)
  const goToHangar = useGameStore((s) => s.goToHangar)

  return (
    <div className="screen screen--lobby">
      <h1>출격 준비</h1>
      <div className="lobby__cards">
        <button className="lobby__card lobby__card--defense" onClick={startStage}>
          <span className="lobby__card-title">방파제 방어</span>
        </button>
        <button className="lobby__card lobby__card--upgrade" onClick={goToHangar}>
          <span className="lobby__card-title">업그레이드</span>
        </button>
        <div className="lobby__card lobby__card--coop is-locked">
          <span className="lobby__card-badge">준비 중</span>
          <span className="lobby__card-title">협동 출격</span>
        </div>
      </div>
      <p className="screen__subtitle">보유 부품 ⚙ {parts}</p>
    </div>
  )
}
