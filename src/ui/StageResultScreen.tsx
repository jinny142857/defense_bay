import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'

export function StageResultScreen() {
  const stageStars = useGameStore((s) => s.stageStars)
  const stageGrade = useGameStore((s) => s.stageGrade)
  const score = useGameStore((s) => s.score)
  const stagePartsEarned = useGameStore((s) => s.stagePartsEarned)
  const durability = useGameStore((s) => s.durability)
  const goToHangar = useGameStore((s) => s.goToHangar)

  return (
    <div className="screen screen--stage-result">
      <h1>STAGE 1 클리어!</h1>
      <div className="stage-result__stars">
        {[1, 2, 3].map((n) => (
          <span key={n} className={n <= (stageStars ?? 0) ? 'star is-filled' : 'star'}>
            ★
          </span>
        ))}
      </div>
      <div className="stage-result__stats">
        <div>점수 {score}</div>
        <div>
          남은 내구도 {durability} / {balance.combat.breakwaterMaxDurability}
        </div>
        <div>획득 부품 ⚙ +{stagePartsEarned}</div>
        <div>성실도 등급 {stageGrade}</div>
      </div>
      <button className="stage-result__next" onClick={goToHangar}>
        격납고로
      </button>
    </div>
  )
}
