import { balance } from '../config/balance'
import type { Attempt, DiligenceGrade } from '../types'

// PRD 3.6-4: (푼 문제 수, 정답률, 평균 풀이 시간, 빠른 연타 횟수)를 합산해 S/A/B/C 등급을 매긴다.
// PRD에 정확한 공식은 없어 구간 기준을 balance.ts 바깥(여기)에서 명시적으로 정의한다.
export function computeDiligenceGrade(attempts: Attempt[]): DiligenceGrade {
  if (attempts.length === 0) return 'C'

  const accuracy = attempts.filter((a) => a.correct).length / attempts.length
  const rapidCount = attempts.filter((a) => a.responseMs < balance.diligence.rapidResponseMs).length

  if (accuracy >= 0.9 && rapidCount === 0) return 'S'
  if (accuracy >= 0.75 && rapidCount <= 1) return 'A'
  if (accuracy >= 0.5) return 'B'
  return 'C'
}

// 스테이지 결과 별점: 내구도 비율 + 성실도 등급 (PRD 4.5)
export function computeStars(grade: DiligenceGrade, durabilityPct: number): 1 | 2 | 3 {
  if ((grade === 'S' || grade === 'A') && durabilityPct >= 0.7) return 3
  if (grade !== 'C' || durabilityPct >= 0.4) return 2
  return 1
}
