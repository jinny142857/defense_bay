# 바다 · 배경 · 몹 연동 가이드 (three.js)

Claude Code에게 이 파일과 `SeaWater.js`를 같이 넘기고
"이 가이드대로 바다/배경/몹 이동을 게임에 붙여줘"라고 요청하면 됩니다.

## 포함 파일

| 파일 | 내용 |
|---|---|
| `SeaWater.js` | 바다 셰이더 `createSea()`, 하늘 `createSky()`, 파도 높이 함수 `getWaveHeight()`, 포그 설정 `SEA_FOG` |
| `Mountains.glb` | 산 배경 10개 (로우폴리, 멀수록 밝은 공기원근 색이 재질에 이미 들어 있음) |
| `Blender_reference_render.png` | 목표 룩 참고 이미지 |
| 몹: `../SeaMobs_GameAssets/Mob_SpikeCrab_LOD.glb`, `Mob_ShellToad_LOD.glb` | 몹 모델 (정면 = +Z, 즉 플레이어 쪽을 봄) |

요구 사항: three.js r155 이상 (`colorspace_fragment` 셰이더 청크 사용).

## 좌표 기준 (1 unit = 1 m)

- **원점(0,0,0) = 방파제/플레이어 위치**, 수면 높이 y = 0
- 바다 쪽(적이 오는 방향) = **-Z**. 산은 z = -190 ~ -810 m 에 배치되어 있음
- 해는 왼쪽 앞 낮은 곳 (`SUN_DIRECTION`)

## 1. 씬 세팅

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createSea, createSky, getWaveHeight, SEA_FOG, SUN_DIRECTION } from './SeaWater.js';

renderer.outputColorSpace = THREE.SRGBColorSpace;
scene.fog = new THREE.Fog(SEA_FOG.color, SEA_FOG.near, SEA_FOG.far);
camera.far = 3000; camera.updateProjectionMatrix();

const sea = createSea();            // 저사양이면 createSea({ segments: 256 })
scene.add(sea);
scene.add(createSky());

// 조명 (몹/산은 MeshStandardMaterial이라 조명 필요)
scene.add(new THREE.HemisphereLight(0xbac4c8, 0x1f3a40, 1.2));
const sun = new THREE.DirectionalLight(0xffe2c0, 1.6);
sun.position.copy(SUN_DIRECTION).multiplyScalar(500);
scene.add(sun);

new GLTFLoader().load('Mountains.glb', (g) => {
  g.scene.traverse((o) => { if (o.isMesh) { o.material.fog = false; o.material.flatShading = true; } });
  // 산 색에 이미 안개 느낌이 들어 있으므로 fog=false (켜면 먼 산이 하늘색으로 사라짐)
  scene.add(g.scene);
});

// 매 프레임
sea.material.uniforms.uTime.value = clock.getElapsedTime();
```

## 2. 몹: 멀리서 다가오기 + 점점 커지기 + 물에 잠기기

- **커지는 효과는 원근감으로 자동**으로 생김. 스케일 애니메이션 불필요.
  멀리(z ≈ -600 ~ -800)에서 스폰 → 방파제(z ≈ 0) 쪽으로 이동시키면 됨.
- **잠김**: 매 프레임 `y = 파도높이 - 잠김깊이`. 파도와 같이 출렁임.
- **기울기**: 파도 경사에 맞춰 살짝 흔들어 주면 떠 있는 느낌이 강해짐.
- 안개(`scene.fog`) 때문에 먼 곳에서는 흐릿하게 나타났다가 다가오며 선명해짐 → 레퍼런스의 등장 연출.

```js
const MOB_TYPES = {
  crab: { url: 'Mob_SpikeCrab_LOD.glb', speed: 9, sink: 0.35 }, // 넓고 낮게 깔린 몹 → 조금만 잠김
  toad: { url: 'Mob_ShellToad_LOD.glb', speed: 6, sink: 0.9 },  // 덩치 큰 몹 → 배까지 잠김
};

function spawnMob(type, template) {
  const mob = template.clone(true);
  mob.userData = { ...MOB_TYPES[type], phase: Math.random() * 10 };
  mob.position.set(THREE.MathUtils.randFloatSpread(300), 0, -THREE.MathUtils.randFloat(600, 800));
  scene.add(mob);
  return mob;
}

function updateMob(mob, t, dt) {
  const { speed, sink, phase } = mob.userData;
  // 방파제(원점) 쪽으로 이동
  const toTarget = new THREE.Vector3(-mob.position.x, 0, -mob.position.z).normalize();
  mob.position.addScaledVector(toTarget, speed * dt);
  mob.rotation.y = Math.atan2(toTarget.x, toTarget.z); // 모델 정면(+Z)이 이동 방향을 보게

  // 파도 위에 떠서 일부 잠김
  const { x, z } = mob.position;
  mob.position.y = getWaveHeight(x, z, t) - sink;

  // 파도 경사에 따라 살짝 기울기
  const e = 1.5;
  const dx = getWaveHeight(x + e, z, t) - getWaveHeight(x - e, z, t);
  const dz = getWaveHeight(x, z + e, t) - getWaveHeight(x, z - e, t);
  mob.rotation.z = -dx * 0.25;
  mob.rotation.x = dz * 0.25 + Math.sin(t * 1.3 + phase) * 0.03;

  if (z > -5) onMobReachedBreakwater(mob); // 방파제 도달 → 내구도 감소 등
}
```

`sink`(잠김 깊이)와 `speed`는 플레이 감각에 맞게 조절.
물 셰이더가 반투명(`depthWrite:false`)이라 **물속에 잠긴 부분이 희미하게 비쳐 보이는 것**이 정상 동작.

## 3. 튜닝 포인트 (SeaWater.js)

| 바꾸고 싶은 것 | 위치 |
|---|---|
| 파도 크기(폭풍 강도) | `createSea({ waveAmp: 1.0 })` 또는 런타임 `sea.material.uniforms.uWaveAmp.value` (0.5 잔잔 ~ 1.4 거침) |
| 파도 방향·파장 | `WAVES` 배열 (steepness 합계 < 1.0 유지) |
| 물 색 | `SEA_COLORS.deep / grazing / sky` |
| 투명도 | `createSea({ opacity: 0.82 })` (낮을수록 물속이 더 보임) |
| 햇빛 반짝임 세기 | 셰이더의 `glint` 줄 |
| 안개 거리 | `SEA_FOG.near / far` |

`uWaveAmp`를 바꾸면 `getWaveHeight(x, z, t, amp)`의 4번째 인자도 같은 값을 넘겨야 몹 높이가 맞음.

## 성능 메모

- 바다 기본 400×400 분할(약 16만 정점). 모바일은 `segments: 256` 권장.
- 몹은 반드시 `_LOD.glb` 사용 (몹 1마리 1~2만 삼각형).
- 몹 수가 많으면 같은 종류는 `InstancedMesh` 고려.
