# 방파제 디펜스 — 아트 바이블 (M2)

이 문서는 `docs/PRD.md` 7장(아트·UI 디자인 가이드)을 실제 제작에 바로 쓸 수 있는 체크리스트·프롬프트 가이드로 정리한 것이다. **이 세션에는 Midjourney/Meshy/Blender MCP 등 생성형 도구가 연결되어 있지 않아 실제 에셋 생성은 수행하지 않았다.** 아래 가이드를 가지고 외부 도구에서 직접 생성·정리한 뒤 `public/assets/`에 GLB로 배치하면, 코드는 임시 도형을 그대로 교체할 수 있도록 설계되어 있다(약점 네이밍 규칙 포함, 2.4절 참고).

## 1. 톤 키워드

**"폭풍우 속 방파제를 지키는 군사 기지"**

- 어두운 필름 그레이드 배경 + 호박색/주황 발광 포인트
- 사선 컷 패널, 해저드 스트라이프, 도트 그리드 금속 판을 공통 언어로 사용
- 괴수는 파편·연기로 사라지고 선혈/잔혹 묘사 없음 (PRD 10.3 리스크 대응)

## 2. 컬러 토큰 (PRD 7.1, `src/index.css`에 이미 반영됨)

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--bg-deep` | #0E1316 | 기본 배경 |
| `--panel` | #121A1F (85%) | 카드·모달 |
| `--panel-line` | #3A4650 | 패널 테두리 1px |
| `--accent-orange-1/2` | #F0782A → #C9481A | 주요 CTA 그라디언트 |
| `--glow-amber` | #FFB067 | 발광, 문제 모달 테두리 |
| `--hazard-yellow` | #F2B22E | 해저드 스트라이프, 부품 숫자 |
| `--ok-green` | #4FD1A1 | 버프, 내구도 바 |
| `--info-blue` | #4AA8E8 | 업그레이드, 레이더 |
| `--danger-red` | #E5484D | 보스 HP, 오답 |
| `--text-cream` | #F3E9D2 | 타이틀 |

새 일러스트/3D 에셋 프롬프트에는 항상 이 팔레트를 색상 레퍼런스로 명시한다.

## 3. 생성형 파이프라인 체크리스트 (PRD 7.7)

1. **아트 바이블 먼저** — 이 문서 + 참고 이미지(별도 보드)를 모든 생성 세션에 공유하고, 모든 프롬프트에 동일한 스타일 문구를 붙인다.
2. **3D용 컨셉 이미지** — 단색 배경, 3/4 뷰, 모델 하나만. 이미지→3D 변환 품질이 가장 좋은 구도.
3. **이미지 → 3D** — Meshy/Tripo로 여러 개 생성 후 선별. 보스처럼 중요도가 높은 모델은 Rodin도 비교.
4. **Blender 정리** — 폴리곤 목표(몹 3천~5천, 보스 2만~3만 삼각형), 약점 부위를 **별도 오브젝트로 분리**하고 이름을 `weak_`로 시작하게 붙인다 (`weak_head`, `weak_core`, `weak_back` 등 — `src/game/Boss.tsx`가 이 이름을 그대로 읽어 자동으로 약점 히트박스를 만든다. 코드 수정 불필요).
5. **내보내기** — GLB + Draco 압축, 텍스처 1K~2K. `public/assets/` 아래 배치.

### 공통 프롬프트 접미사 (제안)

```
, dark storm-grey military base tone, amber/orange rim light accents,
low-poly stylized, no gore, family-friendly, muted teal ocean backdrop
```

### 모델별 프롬프트 키워드

| 대상 | 키워드 |
| --- | --- |
| 포탑(레드 호넷) | compact coastal defense turret, red-orange armor plating, twin barrel |
| 꼬마 게 | small crimson crab-like sea creature, round shell, stubby claws, cartoonish not scary |
| 보급상자 | military supply crate, parachute canopy, color-coded (yellow/red/green) stripe |
| 산호 거신(보스) | coral-encrusted stone titan rising from the sea, glowing cracks at weak points (head/chest/back), imposing but not grotesque |

## 4. 타이포그래피 (PRD 7.2)

- 한글 디스플레이: 굵은 헤드라인체(도현체/김정철체 Bold 등, 라이선스 확인 후 확정)
- 영문/숫자 디스플레이: 스텐실형 산세리프(Black Ops One, Russo One 계열)
- 본문: Pretendard, 문제 본문 22~28px / 보기 20px 이상

## 5. 컴포넌트 규칙 (PRD 7.3, 현재 UI에 일부 반영됨)

- 사선 컷 패널(clip-path 12px) — `src/App.css`의 `.precheck__card` 등에 적용 검토
- 문제 모달: 주황 1px 발광 테두리 — 이미 적용(`question-modal__card`)
- 잠긴 카드: 흑백 + 어둠 60% + 'LOCKED' 스텐실 태그 — 격납고 화면에 적용 필요(M3)

## 6. 접근성 (PRD 7.6)

- 정답/오답은 색상 + 아이콘(✓/✕) 병기 — 현재 텍스트만 사용 중, M3에서 아이콘 추가 필요
- 화면 흔들림·플래시 끄기 옵션, 문제 텍스트 크게 보기, TTS — 모두 M3 이후

## 7. 라이선스 주의사항

- 생성형 도구 결과물의 상업 이용 조건은 도구·요금제마다 다르므로 사용 전 약관 확인
- 기존 게임·영화 캐릭터나 실존 탱크 디자인을 그대로 따라 하는 프롬프트 금지
