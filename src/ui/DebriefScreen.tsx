import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'
import { QuestionModal } from './QuestionModal'

export function DebriefScreen() {
  const crabsDefeated = useGameStore((s) => s.crabsDefeated)
  const durability = useGameStore((s) => s.durability)
  const debriefQuestions = useGameStore((s) => s.debriefQuestions)
  const debriefAttempts = useGameStore((s) => s.debriefAttempts)
  const answerDebrief = useGameStore((s) => s.answerDebrief)
  const waveNumber = useGameStore((s) => s.waveNumber)
  const readLockMultiplier = useGameStore((s) => s.readLockMultiplier)

  const current = debriefQuestions[debriefAttempts.length]
  const answeredCount = debriefAttempts.length

  return (
    <div className="screen screen--debrief">
      <h1>전투 복기 · WAVE {waveNumber}</h1>
      <p className="screen__subtitle">
        처치 {crabsDefeated} · 남은 내구도 {durability} / {balance.combat.breakwaterMaxDurability}
      </p>
      <p className="screen__subtitle">
        이번 웨이브를 되돌아보는 문제 3개를 모두 풀어야 정비로 넘어갑니다. ({answeredCount}/3)
      </p>

      <ul className="debrief__attempts">
        {debriefAttempts.map((a, i) => (
          <li key={a.questionId} className={a.correct ? 'is-correct' : 'is-wrong'}>
            {i + 1}번 문제: {a.correct ? '정답' : '오답 (해설 확인 완료)'}
          </li>
        ))}
      </ul>

      {current && (
        <QuestionModal
          question={current}
          contextLabel={`전투 복기 ${answeredCount + 1}/3`}
          onAnswer={(choice, _correct, responseMs) => answerDebrief(choice, responseMs)}
          minExplanationSec={balance.debrief.minExplanationSec}
          readLockMultiplier={readLockMultiplier}
        />
      )}
    </div>
  )
}
