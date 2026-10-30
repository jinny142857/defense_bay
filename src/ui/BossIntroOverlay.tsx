import { useEffect, useState } from 'react'
import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'

// PRD 5.1 보스 등장 연출(전조→부상→타이틀→복귀)의 타이틀 단계를 표현한다.
// 카메라 연출은 Scene.tsx의 CameraRig가 BOSS_INTRO 상태를 보고 동기화한다.
export function BossIntroOverlay() {
  const finishBossIntro = useGameStore((s) => s.finishBossIntro)
  const [canSkip, setCanSkip] = useState(false)

  useEffect(() => {
    const skipTimer = setTimeout(() => setCanSkip(true), 1500)
    const endTimer = setTimeout(() => finishBossIntro(), balance.boss.introDurationSec * 1000)
    return () => {
      clearTimeout(skipTimer)
      clearTimeout(endTimer)
    }
  }, [finishBossIntro])

  return (
    <div className="boss-intro">
      <div className="boss-intro__warning">⚠ 산호 거신 출현 ⚠</div>
      <div className="boss-intro__subtitle">BOSS · 머리를 노리세요!</div>
      {canSkip && (
        <button className="boss-intro__skip" onClick={finishBossIntro}>
          건너뛰기 ▶
        </button>
      )}
    </div>
  )
}
