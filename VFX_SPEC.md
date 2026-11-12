# 탄착 이펙트 스프라이트시트 (플립북)

`src/game/vfxTextures.ts`의 캔버스 그라디언트 텍스처를 아래 PNG 플립북으로 교체하고,
`ImpactEffect.tsx`에서 시간에 따라 칸을 넘겨 재생합니다.

## 파일

| 파일 | 용도 | 기준점 (칸 아래에서) | 블렌딩 |
|---|---|---|---|
| `explosion_sheet.png` | 포탄이 몹에 맞았을 때 탄착 폭발 (흰 코어 → 주황/빨강 화염 → 회갈색 연기) | 폭발 중심 23% | Normal |
| `sparks_sheet.png` | 탄착 폭발 위에 겹치는 불꽃 파편. explosion과 같은 위치·크기·시작 시점 | 폭발 중심 23% | Additive, renderOrder +1 |
| `waterburst_sheet.png` | 공중 포격 지원: 바다 착탄 물기둥. 착탄 지점마다 1장씩, 시차를 두고 여러 발 | 수면선 10% | Normal |

공중 포격은 물기둥 밑동에 `explosion_sheet`를 약 0.55배 크기로 같이 띄우면 수면에서 불꽃이 터지는 느낌이 납니다.

## 공통 사양

- 1536×1536 RGBA PNG, 투명 배경
- 6×6 격자 = 36프레임, 칸 256×256
- 24fps 기준 1.5초 (재생 속도는 자유롭게 조절)
- 프레임 순서: 왼쪽 위 → 오른쪽 → 다음 줄
- 알파는 일반 알파 (미리 곱해지지 않음). 칸 테두리 알파는 0이라 사각 경계가 생기지 않고, 마지막 칸들은 완전히 투명해짐
- 색 공간: sRGB (`texture.colorSpace = THREE.SRGBColorSpace`)
- 칸 한 변 실제 크기 기준: explosion / sparks 약 4.6 m, waterburst 약 7.4 m

## UV 계산 (three.js, 기본 `flipY = true`)

```ts
const COLS = 6, ROWS = 6, FRAMES = 36;
texture.repeat.set(1 / COLS, 1 / ROWS);

function setFrame(texture: THREE.Texture, frame: number) {
  const f = Math.min(FRAMES - 1, Math.max(0, Math.floor(frame)));
  const col = f % COLS;
  const row = Math.floor(f / COLS);          // 0 = 맨 윗줄
  texture.offset.set(col / COLS, 1 - (row + 1) / ROWS);
}

// 매 프레임: setFrame(tex, elapsedSeconds * 24)
```

인스턴스마다 다른 프레임을 보여주려면 텍스처를 `clone()`하거나, 셰이더에서 프레임 인덱스로 UV를 계산하세요.

## 머티리얼 권장값

```ts
new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false })              // explosion, waterburst
new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false,
                           blending: THREE.AdditiveBlending })                        // sparks
```

기준점이 칸 정중앙이 아니므로 `sprite.center.set(0.5, 0.23)` (waterburst는 `(0.5, 0.10)`)로 맞추면
스프라이트 위치가 곧 폭발 중심 / 수면 위치가 됩니다.
