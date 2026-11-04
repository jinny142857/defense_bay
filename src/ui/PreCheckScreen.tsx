import { useState } from 'react'
import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'
import { QuestionModal } from './QuestionModal'
import type { PreCheckSlot } from '../types'

// 이 점검으로 뭘 얻고 잃는지 미리 보여준다(레퍼런스 "출격 점검" 화면 참고).
const SLOT_EFFECTS: Record<PreCheckSlot['key'], string> = {
  barrel: `정답 공격력 +${Math.round(balance.preCheck.attackBuffPct * 100)}% · 오답 공격력 ${Math.round(balance.preCheck.attackDebuffPct * 100)}%`,
  loader: `정답 공격속도 +${Math.round(balance.preCheck.fireRateBuffPct * 100)}% · 오답 공격속도 ${Math.round(balance.preCheck.fireRateDebuffPct * 100)}%`,
  breakwater: `정답 방파제 내구도 +${balance.preCheck.durabilityBuff} · 오답 방파제 내구도 ${balance.preCheck.durabilityDebuff}`,
}

// "점검 시작"을 눌러야 문제가 시작되고, 한 번 시작하면 끊기지 않고 3문제가 이어진다(아직 안 푼
// 첫 슬롯의 문제를 바로 띄우는 식 — DebriefScreen과 같은 패턴).
export function PreCheckScreen() {
  const slots = useGameStore((s) => s.preCheckSlots)
  const preCheckQuestions = useGameStore((s) => s.preCheckQuestions)
  const answerPreCheck = useGameStore((s) => s.answerPreCheck)
  const waveNumber = useGameStore((s) => s.waveNumber)
  const [started, setStarted] = useState(false)

  const answeredCount = slots.filter((s) => s.answered).length
  const currentSlot = slots.find((s) => !s.answered)
  const currentQuestion = currentSlot && preCheckQuestions[currentSlot.key]

  return (
    <div className="screen screen--precheck">
      <h1>출격 점검 · WAVE {waveNumber}</h1>
      <p className="screen__subtitle">
        웨이브를 시작하기 전, 장비 3곳을 점검합니다. 맞히면 강해지고, 틀리면 약해진 채로
        출격해요. ({answeredCount}/3)
      </p>

      <div className="precheck__cards">
        {slots.map((slot) => (
          <div
            key={slot.key}
            className={
              'precheck__card' +
              (slot.answered ? (slot.correct ? ' is-correct' : ' is-wrong') : '')
            }
          >
            <span className="precheck__card-label">{slot.label}</span>
            <p className="precheck__card-effect">{SLOT_EFFECTS[slot.key]}</p>
            <span className="precheck__card-status">
              {!slot.answered ? '대기' : slot.correct ? '정답' : '오답'}
            </span>
          </div>
        ))}
      </div>

      {!started && (
        <button className="precheck__start" onClick={() => setStarted(true)}>
          점검 시작
        </button>
      )}

      {started && currentSlot && currentQuestion && (
        <QuestionModal
          key={currentQuestion.id}
          question={currentQuestion}
          contextLabel={`출격 점검 ${answeredCount + 1}/3 · ${currentSlot.label}`}
          onAnswer={(choice, _correct, responseMs) => {
            answerPreCheck(currentSlot.key, choice, responseMs)
          }}
        />
      )}
    </div>
  )
}
