import { useEffect, useRef } from 'react'
import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'
import { aimSignal } from '../game/aimSignal'
import { BossHud } from './BossHud'
import { QuestionModal } from './QuestionModal'

const BOX_LABELS: Record<string, string> = {
  parts: '부품 상자',
  bombard: '포격 지원 상자',
  repair: '정비 상자',
}

// aimSignal(Scene.tsx의 AimRay가 매 프레임 갱신)을 Canvas 밖 2D HUD에서 읽어 크로스헤어를
// 그린다. 리렌더 없이 매 프레임 직접 스타일을 건드려야 해서 zustand가 아닌 rAF로 폴링한다.
function AimCrosshair() {
  const ref = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf: number
    const tick = () => {
      const el = ref.current
      if (el) {
        if (aimSignal.visible) {
          el.style.display = ''
          el.style.left = `${aimSignal.screenX * 100}%`
          el.style.top = `${aimSignal.screenY * 100}%`
          el.classList.toggle('hud__crosshair--hit', aimSignal.hit)
          el.classList.toggle('hud__crosshair--miss', !aimSignal.hit)
        } else {
          el.style.display = 'none'
        }
      }
      if (labelRef.current) {
        labelRef.current.textContent = aimSignal.visible ? `${Math.round(aimSignal.distanceM)}m` : ''
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={ref} className="hud__crosshair">
      <span ref={labelRef} className="hud__crosshair-label" />
    </div>
  )
}

const SUPPLY_RESULT_VISIBLE_MS = 2200

// 보급상자 문제를 맞히면 실제로 뭘 얻었는지("공중 포격 지원!", "부품 +8" 등) 잠깐 띄워 보여준다 —
// 예전엔 보상이 조용히 적용만 되고 화면엔 아무 표시가 없어서 "맞혔는데 뭐가 바뀐 건지 모르겠다"는
// 피드백으로 이어졌다.
function SupplyResultBanner() {
  const text = useGameStore((s) => s.supplyResultText)
  const pulse = useGameStore((s) => s.supplyResultPulse)
  const visibleRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (pulse === 0) return
    visibleRef.current = true
    if (containerRef.current) containerRef.current.classList.add('hud__supply-result--visible')
    const t = setTimeout(() => {
      visibleRef.current = false
      if (containerRef.current) containerRef.current.classList.remove('hud__supply-result--visible')
    }, SUPPLY_RESULT_VISIBLE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulse])

  if (!text) return null
  return (
    <div ref={containerRef} className="hud__supply-result">
      {text}
    </div>
  )
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
      <AimCrosshair />
      <SupplyResultBanner />

      {activeSupplyQuestion && (
        <QuestionModal
          key={activeSupplyQuestion.question.id}
          question={activeSupplyQuestion.question}
          contextLabel={`보급상자 · ${BOX_LABELS[activeSupplyQuestion.boxType]}`}
          onAnswer={(choice, _correct, responseMs) => answerSupplyBox(choice, responseMs)}
        />
      )}
    </div>
  )
}
