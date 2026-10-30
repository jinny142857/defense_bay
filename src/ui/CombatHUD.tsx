import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'
import { BossHud } from './BossHud'
import { QuestionModal } from './QuestionModal'

const BOX_LABELS: Record<string, string> = {
  parts: '부품 상자',
  bombard: '포격 지원 상자',
  repair: '정비 상자',
}

export function CombatHUD() {
  const durability = useGameStore((s) => s.durability)
  const crabsRemaining = useGameStore((s) => s.crabsRemaining)
  const crabsTotal = useGameStore((s) => s.crabsTotal)
  const attackBuffPct = useGameStore((s) => s.attackBuffPct)
  const fireRateBuffPct = useGameStore((s) => s.fireRateBuffPct)
  const waveNumber = useGameStore((s) => s.waveNumber)
  const parts = useGameStore((s) => s.parts)
  const bossActive = useGameStore((s) => s.bossActive)
  const activeSupplyQuestion = useGameStore((s) => s.activeSupplyQuestion)
  const answerSupplyBox = useGameStore((s) => s.answerSupplyBox)
  const readLockMultiplier = useGameStore((s) => s.readLockMultiplier)

  const durabilityPct = Math.round((durability / balance.combat.breakwaterMaxDurability) * 100)

  return (
    <div className="hud">
      {bossActive && <BossHud />}
      <div className="hud__top-left">
        <div className="hud__counter">WAVE {waveNumber} · 남은 괴수: {crabsRemaining} / {crabsTotal}</div>
        <div className="hud__counter">부품 ⚙ {parts}</div>
        <div className="hud__buffs">
          {attackBuffPct !== 0 && (
            <span className={attackBuffPct > 0 ? 'chip chip--ok' : 'chip chip--danger'}>
              공격력 {attackBuffPct > 0 ? '+' : ''}{Math.round(attackBuffPct * 100)}%
            </span>
          )}
          {fireRateBuffPct !== 0 && (
            <span className={fireRateBuffPct > 0 ? 'chip chip--ok' : 'chip chip--danger'}>
              공격속도 {fireRateBuffPct > 0 ? '+' : ''}{Math.round(fireRateBuffPct * 100)}%
            </span>
          )}
        </div>
      </div>
      <div className="hud__bottom-left">
        <div className="hud__durability-label">방파제 내구도 {durability} / {balance.combat.breakwaterMaxDurability}</div>
        <div className="hud__durability-bar">
          <div className="hud__durability-fill" style={{ width: `${durabilityPct}%` }} />
        </div>
      </div>
      <div className="hud__crosshair" />

      {activeSupplyQuestion && (
        <QuestionModal
          question={activeSupplyQuestion.question}
          contextLabel={`보급상자 · ${BOX_LABELS[activeSupplyQuestion.boxType]}`}
          readLockMultiplier={readLockMultiplier}
          onAnswer={(choice, _correct, responseMs) => answerSupplyBox(choice, responseMs)}
        />
      )}
    </div>
  )
}
