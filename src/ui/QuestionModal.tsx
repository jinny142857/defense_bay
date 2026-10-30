import { useEffect, useMemo, useState } from 'react'
import type { Question } from '../types'

// PRD 3.6 성실 풀이 장치: 읽기 시간 잠금 + 보기 셔플, 오답 시 해설 최소 노출 + '이해했어요' 게이트
function shuffleIndices(length: number): number[] {
  const idx = Array.from({ length }, (_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx
}

export function QuestionModal({
  question,
  contextLabel,
  onAnswer,
  minExplanationSec = 3,
  readLockMultiplier = 1,
}: {
  question: Question
  contextLabel: string
  onAnswer: (choice: number, correct: boolean, responseMs: number) => void
  minExplanationSec?: number
  readLockMultiplier?: number
}) {
  const order = useMemo(() => shuffleIndices(question.choices.length), [question.id])
  const readLockMs =
    Math.min(4000, Math.max(1500, question.minReadSec * 1000)) * readLockMultiplier

  const [locked, setLocked] = useState(true)
  const [selected, setSelected] = useState<number | null>(null)
  const [explaining, setExplaining] = useState(false)
  const [explainReady, setExplainReady] = useState(false)
  const [readyAt, setReadyAt] = useState<number | null>(null)
  const [responseMs, setResponseMs] = useState(0)

  useEffect(() => {
    setLocked(true)
    setSelected(null)
    setExplaining(false)
    setExplainReady(false)
    setReadyAt(null)
    const t = setTimeout(() => {
      setLocked(false)
      setReadyAt(Date.now())
    }, readLockMs)
    return () => clearTimeout(t)
  }, [question.id, readLockMs])

  useEffect(() => {
    if (!explaining) return
    setExplainReady(false)
    const t = setTimeout(() => setExplainReady(true), minExplanationSec * 1000)
    return () => clearTimeout(t)
  }, [explaining, minExplanationSec])

  const handleChoose = (originalIndex: number) => {
    if (locked || selected !== null) return
    const elapsed = readyAt ? Date.now() - readyAt : 0
    setResponseMs(elapsed)
    setSelected(originalIndex)
    const correct = originalIndex === question.answer
    if (correct) {
      setTimeout(() => onAnswer(originalIndex, true, elapsed), 450)
    } else {
      setExplaining(true)
    }
  }

  return (
    <div className="question-modal">
      <div className="question-modal__card">
        <div className="question-modal__header">
          <span className="question-modal__subject">{question.subject}</span>
          <span className="question-modal__context">{contextLabel}</span>
        </div>
        <p className="question-modal__stem">{question.stem}</p>

        {!explaining && (
          <div className="question-modal__choices">
            {order.map((originalIndex, pos) => {
              const isSelected = selected === originalIndex
              const isCorrect = isSelected && originalIndex === question.answer
              return (
                <button
                  key={originalIndex}
                  className={
                    'question-modal__choice' +
                    (isSelected ? (isCorrect ? ' is-correct' : ' is-wrong') : '')
                  }
                  disabled={locked || selected !== null}
                  onClick={() => handleChoose(originalIndex)}
                >
                  <span className="question-modal__choice-badge">{pos + 1}</span>
                  {question.choices[originalIndex]}
                </button>
              )
            })}
          </div>
        )}

        {locked && !explaining && <p className="question-modal__hint">문제를 읽는 중...</p>}

        {explaining && (
          <div className="question-modal__explanation">
            <p className="question-modal__explanation-title">해설</p>
            <p>{question.explanation}</p>
            <button
              className="question-modal__ack"
              disabled={!explainReady}
              onClick={() => onAnswer(selected as number, false, responseMs)}
            >
              이해했어요
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
