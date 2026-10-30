import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'
import { WEAPON_DEFS } from '../data/weapons'
import { QuestionModal } from './QuestionModal'

const ALL_WEAPON_IDS = Object.keys(WEAPON_DEFS)

export function HangarScreen() {
  const parts = useGameStore((s) => s.parts)
  const ownedWeapons = useGameStore((s) => s.ownedWeapons)
  const equippedWeaponId = useGameStore((s) => s.equippedWeaponId)
  const weaponLevels = useGameStore((s) => s.weaponLevels)
  const pendingUpgrade = useGameStore((s) => s.pendingUpgrade)
  const equipWeapon = useGameStore((s) => s.equipWeapon)
  const requestUpgrade = useGameStore((s) => s.requestUpgrade)
  const answerUpgrade = useGameStore((s) => s.answerUpgrade)
  const startStage = useGameStore((s) => s.startStage)
  const readLockMultiplier = useGameStore((s) => s.readLockMultiplier)

  const equippedDef = WEAPON_DEFS[equippedWeaponId]
  const equippedLevel = weaponLevels[equippedWeaponId] ?? 1
  const nextLevel = equippedLevel + 1
  const upgradeCost = balance.hangar.upgradeCostPerLevel * equippedLevel
  const effectiveAttack = Math.round(
    equippedDef.baseAttack * (1 + balance.hangar.attackPctPerLevel * (equippedLevel - 1)),
  )

  return (
    <div className="screen screen--hangar">
      <h1>격납고</h1>
      <p className="screen__subtitle">보유 부품 ⚙ {parts}</p>

      <div className="hangar__layout">
        <div className="hangar__weapon-list">
          {ALL_WEAPON_IDS.map((id) => {
            const def = WEAPON_DEFS[id]
            const owned = ownedWeapons.includes(id)
            return (
              <button
                key={id}
                className={
                  'hangar__weapon' +
                  (id === equippedWeaponId ? ' is-equipped' : '') +
                  (!owned ? ' is-locked' : '')
                }
                disabled={!owned}
                onClick={() => equipWeapon(id)}
              >
                <span>{owned ? def.name : 'LOCKED'}</span>
                {owned && <span className="hangar__weapon-level">Lv.{weaponLevels[id] ?? 1}</span>}
              </button>
            )
          })}
        </div>

        <div className="hangar__detail">
          <h2>{equippedDef.name} · Lv.{equippedLevel}</h2>
          <p>공격력 {effectiveAttack} · 발사속도 {equippedDef.baseFireRate.toFixed(1)}/초</p>
          {equippedLevel >= balance.hangar.maxLevel ? (
            <p className="hangar__max">최대 레벨입니다</p>
          ) : (
            <button
              className="hangar__upgrade"
              disabled={parts < upgradeCost || !!pendingUpgrade}
              onClick={() => requestUpgrade(equippedWeaponId)}
            >
              강화 (Lv.{nextLevel}, 부품 ⚙ {upgradeCost}
              {nextLevel >= balance.hangar.upgradeQuestionGateLevel ? ' · 문제 통과 필요' : ''})
            </button>
          )}
        </div>
      </div>

      <button className="hangar__sortie" onClick={startStage}>
        다시 출격
      </button>

      {pendingUpgrade && (
        <QuestionModal
          question={pendingUpgrade.question}
          contextLabel={`격납고 · 강화 확인 (Lv.${pendingUpgrade.nextLevel})`}
          readLockMultiplier={readLockMultiplier}
          onAnswer={(choice, _correct, responseMs) => answerUpgrade(choice, responseMs)}
        />
      )}
    </div>
  )
}
