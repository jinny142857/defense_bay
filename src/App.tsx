import { useEffect } from 'react'
import { useGameStore } from './state/gameStore'
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

  useEffect(() => {
    startStage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
