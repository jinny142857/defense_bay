import type { Object3D } from 'three'

// AimRay(Scene.tsx)가 매 프레임 scene.children 전체를 재귀 레이캐스트하면 몹이 늘어날수록
// (특히 산/방파제/바다처럼 폴리곤이 많은 배경까지 매번 훑으면서) 눈에 띄게 느려진다. 실제로
// 조준 대상이 될 수 있는 객체(몹/보스/보급상자/바다)만 여기 등록해 레이캐스트 범위를 좁힌다.
export const raycastTargets = new Set<Object3D>()
