import { useGameStore } from '../state/gameStore'
import { QuestionModal } from './QuestionModal'

// 예전엔 항목마다 버튼을 따로 눌러 열어야 했다 — 한 번 시작하면 끊기지 않고 3문제를 이어서
// 풀도록, 아직 안 푼 첫 슬롯의 문제를 바로 띄운다(DebriefScreen과 같은 패턴).
export function PreCheckScreen() {
  const slots = useGameStore((s) => s.preCheckSlots)
  const preCheckQuestions = useGameStore((s) => s.preCheckQuestions)
  const answerPreCheck = useGameStore((s) => s.answerPreCheck)
  const waveNumber = useGameStore((s) => s.waveNumber)

  const answeredCount = slots.filter((s) => s.answered).length
  const currentSlot = slots.find((s) => !s.answered)

  return (
    <div className="screen screen--precheck">
      <h1>출격 점검 · WAVE {waveNumber}</h1>
      <p className="screen__subtitle">웨이브를 시작하기 전, 장비 3곳을 모두 점검하세요. ({answeredCount}/3)</p>

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
            <span className="precheck__card-status">
              {!slot.answered ? '대기' : slot.correct ? '정답' : '오답'}
            </span>
          </div>
        ))}
      </div>

      {currentSlot && preCheckQuestions[currentSlot.key] && (
        <QuestionModal
          question={preCheckQuestions[currentSlot.key]}
          contextLabel={`출격 점검 ${answeredCount + 1}/3 · ${currentSlot.label}`}
          onAnswer={(choice, _correct, responseMs) => {
            answerPreCheck(currentSlot.key, choice, responseMs)
          }}
        />
      )}
    </div>
  )
}
