import { useEffect, useState } from 'react'
import { useGameStore } from './state/gameStore'
import { Scene } from './game/Scene'
import { LoadingScreen } from './ui/LoadingScreen'
import { LobbyScreen } from './ui/LobbyScreen'
import { PreCheckScreen } from './ui/PreCheckScreen'
import { CombatHUD } from './ui/CombatHUD'
import { BossIntroOverlay } from './ui/BossIntroOverlay'
import { DefeatScreen } from './ui/DefeatScreen'
import { DebriefScreen } from './ui/DebriefScreen'
import { MaintenanceScreen } from './ui/MaintenanceScreen'
import { StageResultScreen } from './ui/StageResultScreen'
import { HangarScreen } from './ui/HangarScreen'
import { ScreenTransition } from './ui/ScreenTransition'
import './App.css'

const MIN_LOADING_MS = 900

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
  // PRD 9.3/9.5: IndexedDB에서 이전 진행 상황을 다 불러올 때까지 기다린다. 새 세션이면
  // gameStore 기본값(phase: 'LOBBY')이 그대로 쓰이고, 저장된 게 있으면 끝났던 지점
  // (열려 있던 문제 포함)을 그대로 이어간다.
  const [hydrated, setHydrated] = useState(() => useGameStore.persist.hasHydrated())
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)

  useEffect(() => {
    if (hydrated) return
    return useGameStore.persist.onFinishHydration(() => setHydrated(true))
  }, [hydrated])

  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), MIN_LOADING_MS)
    return () => clearTimeout(t)
  }, [])

  const booting = !hydrated || !minTimeElapsed

  if (booting) {
    return (
      <div className="app">
        <LoadingScreen />
      </div>
    )
  }

  const showScene = phase === 'COMBAT' || phase === 'BOSS_INTRO'
  // 전투 중 보스 등장 오버레이가 뜨고 사라지는 건 같은 장면이므로 셔터를 띄우지 않는다.
  const transitionGroup = showScene ? 'playfield' : phase

  return (
    <div className="app">
      <ScreenTransition transitionKey={transitionGroup}>
        {phase === 'LOBBY' && <LobbyScreen />}
        {phase === 'PRE_CHECK' && <PreCheckScreen />}
        {phase === 'WAVE_INTRO' && <WaveIntroScreen />}
        {showScene && (
          <>
            <Scene />
            {phase === 'COMBAT' && <CombatHUD />}
            {phase === 'BOSS_INTRO' && <BossIntroOverlay />}
          </>
        )}
        {phase === 'DEFEAT' && <DefeatScreen />}
        {phase === 'DEBRIEF' && <DebriefScreen />}
        {phase === 'MAINTENANCE' && <MaintenanceScreen />}
        {phase === 'STAGE_RESULT' && <StageResultScreen />}
        {phase === 'HANGAR' && <HangarScreen />}
      </ScreenTransition>
    </div>
  )
}
