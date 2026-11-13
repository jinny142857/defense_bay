import { useGameStore } from '../state/gameStore'
import { getEffectiveBossMaxHp, getStageDef } from '../data/stages'

const WEAK_LABELS = ['머리', '가슴', '등']

export function BossHud() {
  const bossHp = useGameStore((s) => s.bossHp)
  const bossExposed = useGameStore((s) => s.bossExposed)
  const bossWeakPointIndex = useGameStore((s) => s.bossWeakPointIndex)
  const bossAttackTelegraphed = useGameStore((s) => s.bossAttackTelegraphed)
  const bossShellFlying = useGameStore((s) => s.bossShellFlying)
  const currentStageId = useGameStore((s) => s.currentStageId)

  const hpPct = Math.max(0, Math.round((bossHp / getEffectiveBossMaxHp(currentStageId)) * 100))

  return (
    <div className="boss-hud">
      <div className="boss-hud__name">{getStageDef(currentStageId).bossAsset.displayName}</div>
      <div className="boss-hud__bar">
        <div className="boss-hud__bar-fill" style={{ width: `${hpPct}%` }} />
      </div>
      <div className={'boss-hud__status' + (bossExposed ? ' is-exposed' : ' is-defended')}>
        {bossExposed
          ? `약점 노출 중 · ${WEAK_LABELS[bossWeakPointIndex]}을(를) 노리세요!`
          : '약점 방어 중'}
      </div>
      {bossAttackTelegraphed && <div className="boss-hud__warning">⚠ 파도 공격 경고!</div>}
      {bossShellFlying && <div className="boss-hud__warning">🔥 포탄이 날아옵니다! 쏴서 막으세요!</div>}
    </div>
  )
}
