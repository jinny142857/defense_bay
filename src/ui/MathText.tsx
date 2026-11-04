import type { ReactNode } from 'react'

const FRACTION_RE = /(\d+)\/(\d+)/g

// 문제 지문/보기에 들어있는 "1/3" 같은 텍스트 분수를 분자/분모를 위아래로 쌓은 실제 분수 모양으로
// 바꿔 보여준다(PRD 수학 표기 요구사항 — 초등학생에게는 "1/3"보다 익숙한 가로줄 표기가 맞다).
export function MathText({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let lastIndex = 0
  let key = 0
  for (const match of text.matchAll(FRACTION_RE)) {
    const index = match.index ?? 0
    if (index > lastIndex) parts.push(text.slice(lastIndex, index))
    parts.push(
      <span className="fraction" key={`frac-${key++}`}>
        <span className="fraction__num">{match[1]}</span>
        <span className="fraction__den">{match[2]}</span>
      </span>,
    )
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return <>{parts}</>
}
