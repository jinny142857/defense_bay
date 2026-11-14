import type { VehicleDef, VehicleRenderAsset } from '../types'

// 지금 게임에 실제로 떠 있는 파란 전차(BlueTank_GameAssets, Turret.tsx가 원래 하드코딩하던 값).
// render를 안 정한 기체는 전부 이 모델로 보인다.
export const DEFAULT_VEHICLE_RENDER: VehicleRenderAsset = {
  modelUrl: '/assets/tank.glb',
  scale: 0.32,
  wrapperRotationY: Math.PI / 2,
  recoilDistance: 0.35,
}

// PRD 6.2 격납고 해금 규칙. 스테이지 2까지만 구현돼 있어 black_titan은 아직
// 잠금 상태로만 노출한다(스테이지 5가 생기면 그때 stages.ts clearUnlock에 연결).
// 레드 썬더 Mk.II는 스테이지 클리어가 아니라 부품 구매(purchaseCost)로 해금되는
// 첫 기체 — 장착하면 공격력/발사속도에 보너스가 붙는다(TankMkII_GameAssets 가이드).
export const VEHICLE_DEFS: Record<string, VehicleDef> = {
  red_hornet: { id: 'red_hornet', name: '레드 호넷', unlockHint: '시작 기체' },
  yellow_ranger: { id: 'yellow_ranger', name: '옐로 레인저', unlockHint: '스테이지 2 클리어 필요' },
  black_titan: { id: 'black_titan', name: '블랙 타이탄', unlockHint: '스테이지 5 클리어 필요' },
  mk2_red_thunder: {
    id: 'mk2_red_thunder',
    name: '레드 썬더 Mk.II',
    unlockHint: '부품 구매',
    purchaseCost: 300,
    attackPct: 0.15,
    fireRatePct: 0.1,
    render: {
      modelUrl: '/assets/tank-mk2.glb',
      // MkII 원본 모델 자체가 기본 전차보다 20~25% 크게 제작돼 있어(Tank_Root 대비
      // TankMkII_Root 바운딩박스 비율) 배율은 그대로 두는 것만으로 "더 큰 전차"가 된다.
      scale: 0.32,
      wrapperRotationY: Math.PI / 2,
      recoilDistance: 0.55,
      shellModelUrl: '/assets/shell-mk2.glb',
    },
  },
}

export const STARTING_VEHICLE_ID = 'red_hornet'

export function getVehicleRender(vehicleId: string): VehicleRenderAsset {
  return VEHICLE_DEFS[vehicleId]?.render ?? DEFAULT_VEHICLE_RENDER
}
