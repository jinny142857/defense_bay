import { useState } from 'react'
import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'
import { QuestionModal } from './QuestionModal'

export function MaintenanceScreen() {
  const durability = useGameStore((s) => s.durability)
  const repairQuestion = useGameStore((s) => s.maintenanceRepairQuestion)
  const repairDone = useGameStore((s) => s.maintenanceRepairDone)
  const bonusQuestion = useGameStore((s) => s.maintenanceBonusQuestion)
  const bonusUsed = useGameStore((s) => s.maintenanceBonusUsed)
  const answerMaintenanceRepair = useGameStore((s) => s.answerMaintenanceRepair)
  const answerMaintenanceBonus = useGameStore((s) => s.answerMaintenanceBonus)
  const finishMaintenance = useGameStore((s) => s.finishMaintenance)
  const waveNumber = useGameStore((s) => s.waveNumber)
  const readLockMultiplier = useGameStore((s) => s.readLockMultiplier)

  const [openModal, setOpenModal] = useState<'repair' | 'bonus' | null>(null)
  const bonusRemaining = balance.maintenance.bonusMaxAttempts - bonusUsed
  const bonusReward = balance.maintenance.bonusPartsReward[bonusUsed] ?? null

  return (
    <div className="screen screen--maintenance">
      <h1>WAVE {waveNumber} 방어 성공! · 정비 시간</h1>
      <p className="screen__subtitle">현재 내구도 {durability} / {balance.combat.breakwaterMaxDurability}</p>

      <div className="maintenance__cards">
        <div className={'maintenance__card' + (repairDone ? ' is-done' : '')}>
          <h2>방파제 수리</h2>
          <p>문제를 맞히면 내구도 +{balance.maintenance.repairDurability}</p>
          <button
            disabled={repairDone || !repairQuestion}
            onClick={() => setOpenModal('repair')}
          >
            {repairDone ? '수리 완료' : '수리 문제 풀기'}
          </button>
        </div>

        <div className={'maintenance__card' + (bonusRemaining <= 0 ? ' is-done' : '')}>
          <h2>보너스 문제</h2>
          <p>남은 기회 {Math.max(0, bonusRemaining)}{bonusReward ? ` · 다음 보상 부품 +${bonusReward}` : ''}</p>
          <button
            disabled={bonusRemaining <= 0 || !bonusQuestion}
            onClick={() => setOpenModal('bonus')}
          >
            보너스 문제 풀기
          </button>
        </div>
      </div>

      <button className="maintenance__next" onClick={finishMaintenance}>
        {waveNumber < 3 ? '다음 웨이브 시작' : '스테이지 결과 보기'}
      </button>

      {openModal === 'repair' && repairQuestion && (
        <QuestionModal
          question={repairQuestion}
          contextLabel="정비 · 방파제 수리"
          readLockMultiplier={readLockMultiplier}
          onAnswer={(choice, _correct, responseMs) => {
            answerMaintenanceRepair(choice, responseMs)
            setOpenModal(null)
          }}
        />
      )}

      {openModal === 'bonus' && bonusQuestion && (
        <QuestionModal
          question={bonusQuestion}
          contextLabel={`정비 · 보너스 문제 (남은 기회 ${bonusRemaining})`}
          readLockMultiplier={readLockMultiplier}
          onAnswer={(choice, _correct, responseMs) => {
            answerMaintenanceBonus(choice, responseMs)
            setOpenModal(null)
          }}
        />
      )}
    </div>
  )
}
