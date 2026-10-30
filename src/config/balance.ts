// 게임 수치는 전부 이 파일에 모은다 (Handoff 3장 지시). PRD 수치는 초안이며 플레이 테스트로 조정한다.

export const balance = {
  // PRD 3.2 출격 점검 보상/페널티
  preCheck: {
    attackBuffPct: 0.1,
    attackDebuffPct: -0.15,
    fireRateBuffPct: 0.1,
    fireRateDebuffPct: -0.15,
    durabilityBuff: 20,
    durabilityDebuff: -20,
  },

  // PRD 3.5 정비 시간
  maintenance: {
    repairDurability: 30,
    bonusMaxAttempts: 3,
    // 보너스 문제를 풀수록 보상 증가 (+8 -> +10 -> +12)
    bonusPartsReward: [8, 10, 12],
  },

  // PRD 4 전투
  combat: {
    breakwaterMaxDurability: 100,
    crabDamageOnHit: 10, // 꼬마 게가 방파제에 닿았을 때 피해
    crabSpeed: 6, // m/s, 수평선 -> 방파제
    crabSpawnIntervalSec: 1.2,
  },

  // PRD 4.3 스테이지 1, 웨이브별 일반 몹 수 (3웨이브는 보스 포함)
  wave: {
    crabCountsByWave: [12, 16, 20] as const,
  },

  // PRD 3.3 보급상자
  supplyBox: {
    spawnMinPerWave: 2,
    spawnMaxPerWave: 4,
    fallDurationSec: 10,
    partsReward: 10,
    repairDurability: 20,
    infiniteReloadSec: 10,
    bombardBossDamagePct: 0.08,
    bombardWeakExposureBonusSec: 3,
  },

  // PRD 5 보스 (산호 거신)
  boss: {
    maxHp: 900,
    weakMultiplier: 3.0,
    normalMultiplier: 0.1,
    exposedSec: 6,
    defendedSec: 4,
    attackTelegraphSec: 2,
    attackIntervalSec: 8,
    attackDamage: 10,
    weakHitScore: 20,
    defeatScore: 1000,
    // 전조 발동 조건: 일반 몹이 이 비율 이하로 줄면 BOSS_INTRO 트리거
    triggerMobRatio: 0.5,
    introDurationSec: 6,
  },

  // 전투 점수 (PRD 4.4)
  score: {
    crabDefeated: 100,
  },

  // PRD 6.2~6.4 격납고
  hangar: {
    upgradeCostPerLevel: 30,
    maxLevel: 10,
    attackPctPerLevel: 0.08,
    upgradeQuestionGateLevel: 5, // 이 레벨 이상으로 강화할 때 문제 게이트
    clearBonusPerStar: 50,
  },

  // PRD 3.4 전투 복기
  debrief: {
    questionCount: 3,
    minExplanationSec: 3,
  },

  // PRD 3.2 출격 점검
  preCheckQuestionCount: 3,

  // PRD 3.6 성실 풀이 장치
  diligence: {
    rapidResponseMs: 800,
    rapidStreakForDoubleLock: 3,
  },
} as const
