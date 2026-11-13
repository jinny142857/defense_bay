import { useGameStore } from '../state/gameStore'
import { STAGE_DEFS } from '../data/stages'

// PRD 2장 출격 준비: 스테이지 카드들(방파제 방어) + 업그레이드 + 협동 출격.
// 스테이지는 순서대로 클리어해야 다음 스테이지가 열린다(maxStageUnlocked).
// 협동 출격은 PRD 1.4에 따라 진입점만 '준비 중'으로 노출한다.
export function LobbyScreen() {
  const parts = useGameStore((s) => s.parts)
  const startStage = useGameStore((s) => s.startStage)
  const goToHangar = useGameStore((s) => s.goToHangar)
  const maxStageUnlocked = useGameStore((s) => s.maxStageUnlocked)
  const stageClears = useGameStore((s) => s.stageClears)

  return (
    <div className="screen screen--lobby">
      <h1>출격 준비</h1>
      <div className="lobby__cards">
        {STAGE_DEFS.map((stage) => {
          const unlocked = stage.id <= maxStageUnlocked
          const clear = stageClears[stage.id]
          return (
            <button
              key={stage.id}
              className={
                'lobby__card lobby__card--defense' +
                (stage.id === 2 ? ' lobby__card--stage2' : '') +
                (!unlocked ? ' is-locked' : '')
              }
              disabled={!unlocked}
              onClick={() => startStage(stage.id)}
            >
              {clear && <span className="lobby__card-badge">{'★'.repeat(clear.stars)}</span>}
              <span className="lobby__card-title">
                {unlocked ? stage.label : `LOCKED · 스테이지 ${stage.id - 1} 클리어 필요`}
              </span>
            </button>
          )
        })}
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
