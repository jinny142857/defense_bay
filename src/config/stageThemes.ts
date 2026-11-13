// SeaEnvironment_GameAssets/StageThemes.js를 R3F 프로젝트 구조에 맞게 옮긴 것.
// 원본 수치(바다 색/파도진폭/안개/태양광/히미스피어/노출)는 그대로 가져오되, waveAmp만
// 이 프로젝트가 이미 적용해 둔 "거의 평평한 바다"(Sea.tsx 참고 — 큰 파고가 멀미난다는
// 피드백으로 0.04까지 낮춤) 비율을 유지하도록 같은 배율(0.04)을 곱해서 쓴다.
// 0.04 = 스테이지 1의 원래 waveAmp(1.0)에 이미 적용돼 있던 축소 배율.
const FLATTEN = 0.04

export interface StageTheme {
  name: string
  // null이면 기존 Mountains(스테이지 1)를 그대로 쓴다.
  sceneryUrl: string | null
  // null이면 Sea.tsx의 절차적 하늘(createSky)을 그대로 쓴다.
  skyUrl: string | null
  sea: {
    deep: number
    grazing: number
    sky: number
    foam: number
    sun: number
    waveAmp: number
    opacity: number
  }
  fog: { color: number; near: number; far: number }
  sun: { dir: [number, number, number]; color: number; intensity: number }
  hemi: { sky: number; ground: number; intensity: number }
  exposure: number
  bloom?: boolean
  snow?: boolean
}

export const STAGE_THEMES: Record<number, StageTheme> = {
  1: {
    name: '흐린 바다 (기본)',
    sceneryUrl: null,
    skyUrl: null,
    sea: { deep: 0x1f4f5a, grazing: 0x56767f, sky: 0x6a7e86, foam: 0xdfe8ea, sun: 0xffe2c0, waveAmp: 1.0 * FLATTEN, opacity: 0.82 },
    fog: { color: 0x9aa4a8, near: 120, far: 950 },
    sun: { dir: [-0.45, 0.14, -0.88], color: 0xffe2c0, intensity: 1.6 },
    hemi: { sky: 0xbac4c8, ground: 0x1f3a40, intensity: 1.2 },
    exposure: 1.0,
  },
  2: {
    name: '해파리 대왕 · 달밤 바다',
    sceneryUrl: '/assets/stage2-scenery.glb',
    skyUrl: '/assets/sky-stage2-night.png',
    sea: { deep: 0x0a1030, grazing: 0x2a2a58, sky: 0x3a3266, foam: 0xb8c8ff, sun: 0xdde6ff, waveAmp: 0.7 * FLATTEN, opacity: 0.8 },
    fog: { color: 0x2a2048, near: 160, far: 1100 },
    sun: { dir: [0.35, 0.25, -0.9], color: 0xb8c4ff, intensity: 0.9 },
    hemi: { sky: 0x6a5aa8, ground: 0x0a0c20, intensity: 0.9 },
    exposure: 1.1,
    bloom: true,
  },
  3: {
    name: '빙하 거신 · 설원 바다',
    sceneryUrl: '/assets/stage3-scenery.glb',
    skyUrl: '/assets/sky-stage3-snow.png',
    sea: { deep: 0x163848, grazing: 0x5e7e8e, sky: 0x9aaab4, foam: 0xf2f7fa, sun: 0xffffff, waveAmp: 0.85 * FLATTEN, opacity: 0.78 },
    fog: { color: 0xc8d2d8, near: 90, far: 800 },
    sun: { dir: [-0.3, 0.18, -0.94], color: 0xf4f6ff, intensity: 1.4 },
    hemi: { sky: 0xdfe8ee, ground: 0x2a4450, intensity: 1.4 },
    exposure: 1.0,
    snow: true,
  },
}

export function getStageTheme(stageId: number): StageTheme {
  return STAGE_THEMES[stageId] ?? STAGE_THEMES[1]
}
