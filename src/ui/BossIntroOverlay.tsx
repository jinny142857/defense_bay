import { useEffect, useState } from 'react'
import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'

// PRD 5.1 보스 등장 연출의 타이틀 단계. 카메라가 바다 한가운데 고정된 거신 둘레를
// 한 바퀴 도는 동안(Scene.tsx의 CameraRig) 이름·약점만 보여주고, 아무 키/클릭이나
// 누르면 바로 전투(웨이브 3)로 넘어간다. 입력이 없으면 연출 시간이 끝났을 때 자동으로 넘어간다.
export function BossIntroOverlay() {
  const finishBossIntro = useGameStore((s) => s.finishBossIntro)
  const [canAdvance, setCanAdvance] = useState(false)

  useEffect(() => {
    const advanceGateTimer = setTimeout(() => setCanAdvance(true), 800)
    const endTimer = setTimeout(() => finishBossIntro(), balance.boss.introDurationSec * 1000)
    return () => {
      clearTimeout(advanceGateTimer)
      clearTimeout(endTimer)
    }
  }, [finishBossIntro])

  useEffect(() => {
    if (!canAdvance) return
    const handleAdvance = () => finishBossIntro()
    window.addEventListener('keydown', handleAdvance)
    window.addEventListener('pointerdown', handleAdvance)
    return () => {
      window.removeEventListener('keydown', handleAdvance)
      window.removeEventListener('pointerdown', handleAdvance)
    }
  }, [canAdvance, finishBossIntro])

  return (
    <div className="boss-intro">
      <div className="boss-intro__warning">⚠ 산호 거신 출현 ⚠</div>
      <div className="boss-intro__subtitle">BOSS · 머리를 노리세요!</div>
      {canAdvance && <div className="boss-intro__hint">아무 키나 누르거나 클릭하면 전투가 시작됩니다</div>}
    </div>
  )
}
