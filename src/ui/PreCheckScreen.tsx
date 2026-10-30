import { useState } from 'react'
import { useGameStore } from '../state/gameStore'
import { QuestionModal } from './QuestionModal'
import type { PreCheckSlot } from '../types'

export function PreCheckScreen() {
  const slots = useGameStore((s) => s.preCheckSlots)
  const preCheckQuestions = useGameStore((s) => s.preCheckQuestions)
  const answerPreCheck = useGameStore((s) => s.answerPreCheck)
  const waveNumber = useGameStore((s) => s.waveNumber)
  const readLockMultiplier = useGameStore((s) => s.readLockMultiplier)
  const [openSlot, setOpenSlot] = useState<PreCheckSlot['key'] | null>(null)

  const answeredCount = slots.filter((s) => s.answered).length

  return (
    <div className="screen screen--precheck">
      <h1>출격 점검 · WAVE {waveNumber}</h1>
      <p className="screen__subtitle">웨이브를 시작하기 전, 장비 3곳을 모두 점검하세요. ({answeredCount}/3)</p>

      <div className="precheck__cards">
        {slots.map((slot) => (
          <button
            key={slot.key}
            className={
              'precheck__card' +
              (slot.answered ? (slot.correct ? ' is-correct' : ' is-wrong') : '')
            }
            disabled={slot.answered}
            onClick={() => setOpenSlot(slot.key)}
          >
            <span className="precheck__card-label">{slot.label}</span>
            <span className="precheck__card-status">
              {!slot.answered ? '대기' : slot.correct ? '정답' : '오답'}
            </span>
          </button>
        ))}
      </div>

      {openSlot && preCheckQuestions[openSlot] && (
        <QuestionModal
          question={preCheckQuestions[openSlot]}
          contextLabel={`출격 점검 ${answeredCount + 1}/3 · ${slots.find((s) => s.key === openSlot)?.label}`}
          readLockMultiplier={readLockMultiplier}
          onAnswer={(choice, _correct, responseMs) => {
            answerPreCheck(openSlot, choice, responseMs)
            setOpenSlot(null)
          }}
        />
      )}
    </div>
  )
}
