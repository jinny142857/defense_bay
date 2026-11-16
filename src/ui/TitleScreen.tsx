import { useState } from 'react'
import { useGameStore } from '../state/gameStore'

// 저장된 진행 상황이 있어도 항상 이 화면에서 시작한다(App.tsx의 로컬 상태로만 관리 — 저장소에는
// 남기지 않아서 새로고침할 때마다 다시 뜬다). "이어하기"는 기존 저장 데이터를 유지한 채 출격
// 준비 화면으로, "새로 시작"은 확인을 한 번 더 받은 뒤 저장 데이터를 완전히 지우고 새로고침한다.
function hasExistingProgress(): boolean {
  const s = useGameStore.getState()
  return (
    s.parts > 0 ||
    s.maxStageUnlocked > 1 ||
    Object.keys(s.stageClears).length > 0 ||
    s.ownedVehicles.length > 1 ||
    s.ownedWeapons.length > 1
  )
}

export function TitleScreen({ onDone }: { onDone: () => void }) {
  const goToLobby = useGameStore((s) => s.goToLobby)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [hasSave] = useState(hasExistingProgress)

  const handleContinue = () => {
    // 저장된 phase가 전투/문제 화면 등 중간 지점이었을 수 있어, 항상 안전한 출격 준비
    // 화면으로 간다 — 진행 데이터(부품/클리어/보유 장비)는 그대로 유지된다.
    goToLobby()
    onDone()
  }

  const handleStart = () => onDone()

  const handleResetClick = () => {
    if (!confirmingReset) {
      setConfirmingReset(true)
      return
    }
    useGameStore.persist.clearStorage()
    window.location.reload()
  }

  return (
    <div className="screen screen--title">
      <h1>방파제 디펜스</h1>
      <p className="screen__subtitle">분수와 함께 지키는 바다</p>
      <div className="title__actions">
        {hasSave ? (
          <>
            <button className="title__btn title__btn--primary" onClick={handleContinue}>
              이어하기
            </button>
            {confirmingReset ? (
              <div className="title__confirm">
                <span>저장된 진행 상황이 모두 사라집니다. 정말 새로 시작할까요?</span>
                <div className="title__confirm-actions">
                  <button className="title__btn title__btn--danger" onClick={handleResetClick}>
                    새로 시작(확인)
                  </button>
                  <button className="title__btn" onClick={() => setConfirmingReset(false)}>
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <button className="title__btn" onClick={handleResetClick}>
                새로 시작
              </button>
            )}
          </>
        ) : (
          <button className="title__btn title__btn--primary" onClick={handleStart}>
            시작하기
          </button>
        )}
      </div>
    </div>
  )
}
