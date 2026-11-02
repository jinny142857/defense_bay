import { useEffect, useState } from 'react'
import { useGameStore } from './state/gameStore'
import { hadSavedState } from './state/idbStorage'
import { Scene } from './game/Scene'
import { PreCheckScreen } from './ui/PreCheckScreen'
import { CombatHUD } from './ui/CombatHUD'
import { BossIntroOverlay } from './ui/BossIntroOverlay'
import { DebriefScreen } from './ui/DebriefScreen'
import { MaintenanceScreen } from './ui/MaintenanceScreen'
import { StageResultScreen } from './ui/StageResultScreen'
import { HangarScreen } from './ui/HangarScreen'
import './App.css'

function WaveIntroScreen() {
  const beginWave = useGameStore((s) => s.beginWave)
  const waveNumber = useGameStore((s) => s.waveNumber)

  useEffect(() => {
    const t = setTimeout(() => beginWave(), 2500)
    return () => clearTimeout(t)
  }, [beginWave])

  return (
    <div className="screen screen--wave-intro">
      <h1>WAVE {waveNumber} / 3</h1>
      <p>{waveNumber === 3 ? '수평선 너머로 거대한 기척이 느껴집니다' : '수평선에서 괴수들이 다가옵니다'}</p>
    </div>
  )
}

export default function App() {
  const phase = useGameStore((s) => s.phase)
  const startStage = useGameStore((s) => s.startStage)
  // PRD 9.3/9.5: IndexedDB에서 이전 진행 상황을 다 불러올 때까지 기다렸다가,
  // 저장된 게 없는 완전히 새 세션일 때만 1웨이브부터 시작한다. 저장된 게 있으면
  // 끝났던 지점(열려 있던 문제 포함)을 그대로 이어간다.
  const [hydrated, setHydrated] = useState(() => useGameStore.persist.hasHydrated())

  useEffect(() => {
    if (hydrated) return
    return useGameStore.persist.onFinishHydration(() => setHydrated(true))
  }, [hydrated])

  useEffect(() => {
    if (!hydrated || hadSavedState) return
    startStage()
  }, [hydrated, startStage])

  if (!hydrated) {
    return (
      <div className="app">
        <div className="screen screen--loading">
          <p>불러오는 중...</p>
        </div>
      </div>
    )
  }

  const showScene = phase === 'COMBAT' || phase === 'BOSS_INTRO'

  return (
    <div className="app">
      {phase === 'PRE_CHECK' && <PreCheckScreen />}
      {phase === 'WAVE_INTRO' && <WaveIntroScreen />}
      {showScene && (
        <>
          <Scene />
          {phase === 'COMBAT' && <CombatHUD />}
          {phase === 'BOSS_INTRO' && <BossIntroOverlay />}
        </>
      )}
      {phase === 'DEBRIEF' && <DebriefScreen />}
      {phase === 'MAINTENANCE' && <MaintenanceScreen />}
      {phase === 'STAGE_RESULT' && <StageResultScreen />}
      {phase === 'HANGAR' && <HangarScreen />}
    </div>
  )
}
