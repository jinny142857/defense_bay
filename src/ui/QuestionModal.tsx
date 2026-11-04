import { useMemo, useState } from 'react'
import type { Question } from '../types'
import { MathText } from './MathText'

// 보기 순서를 섞어서 "위치로 외우기"를 막는다.
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
}: {
  question: Question
  contextLabel: string
  onAnswer: (choice: number, correct: boolean, responseMs: number) => void
}) {
  const order = useMemo(() => shuffleIndices(question.choices.length), [question.id])
  const [openedAt] = useState(() => Date.now())
  const [selected, setSelected] = useState<number | null>(null)
  const [explaining, setExplaining] = useState(false)

  const handleChoose = (originalIndex: number) => {
    if (selected !== null) return
    const elapsed = Date.now() - openedAt
    setSelected(originalIndex)
    const correct = originalIndex === question.answer
    if (correct) {
      setTimeout(() => onAnswer(originalIndex, true, elapsed), 350)
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
        <p className="question-modal__stem">
          <MathText text={question.stem} />
        </p>

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
                  disabled={selected !== null}
                  onClick={() => handleChoose(originalIndex)}
                >
                  <span className="question-modal__choice-badge">{pos + 1}</span>
                  <MathText text={question.choices[originalIndex]} />
                </button>
              )
            })}
          </div>
        )}

        {explaining && (
          <div className="question-modal__explanation">
            <p className="question-modal__explanation-title">해설</p>
            <p>
              <MathText text={question.explanation} />
            </p>
            <button
              className="question-modal__ack"
              onClick={() => onAnswer(selected as number, false, Date.now() - openedAt)}
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
