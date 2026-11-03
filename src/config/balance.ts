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
    crabDamageOnHit: 10, // 몹이 방파제에 닿았을 때 피해
    crabSpawnIntervalSec: 1.2,
  },

  // 몹 모델(SeaMobs_GameAssets, README_for_ClaudeCode.md 가이드)별 이동/잠김 수치.
  // speed: m/s, sink: 파도 높이 대비 잠기는 깊이(m). 게는 얕게, 거북두꺼비는 배까지 잠기도록 기본값을 둠.
  // 플레이 테스트하면서 숫자만 조절하면 됨.
  // hp: 기본 포탄(고폭 포탄 공격력 64) 기준 게=2방, 두꺼비=4방 정도에 죽도록 잡은 값.
  // 게 < 두꺼비 <<<< 보스(900) 순으로 맷집 차이를 둔다.
  mobs: {
    crab: { speed: 9, sink: 0.35, scale: 1, hp: 100 },
    frogTurtle: { speed: 6, sink: 0.9, scale: 1, hp: 220 },
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
