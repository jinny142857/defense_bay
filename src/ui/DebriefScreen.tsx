import { useState } from 'react'
import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'
import { QuestionModal } from './QuestionModal'

// "복기 시작"을 눌러야 문제가 시작된다(출격 점검과 같은 패턴) — 전투 요약만 먼저 보여주고,
// 시작하면 3문제가 끊기지 않고 이어진다.
export function DebriefScreen() {
  const crabsDefeated = useGameStore((s) => s.crabsDefeated)
  const durability = useGameStore((s) => s.durability)
  const debriefQuestions = useGameStore((s) => s.debriefQuestions)
  const debriefAttempts = useGameStore((s) => s.debriefAttempts)
  const answerDebrief = useGameStore((s) => s.answerDebrief)
  const waveNumber = useGameStore((s) => s.waveNumber)
  const [started, setStarted] = useState(false)

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

      {!started && (
        <button className="precheck__start" onClick={() => setStarted(true)}>
          복기 시작
        </button>
      )}

      {started && current && (
        <QuestionModal
          key={current.id}
          question={current}
          contextLabel={`전투 복기 ${answeredCount + 1}/3`}
          onAnswer={(choice, _correct, responseMs) => answerDebrief(choice, responseMs)}
        />
      )}
    </div>
  )
}
