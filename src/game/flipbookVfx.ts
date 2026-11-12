import { TextureLoader } from 'three'
import type { Texture } from 'three'

// VFX_SPEC.md 사양: 1536x1536, 6x6 격자 = 36프레임, 24fps 기준 1.5초, 알파 포함, 기본 flipY.
export const FLIPBOOK_COLS = 6
export const FLIPBOOK_ROWS = 6
export const FLIPBOOK_FRAMES = FLIPBOOK_COLS * FLIPBOOK_ROWS
export const FLIPBOOK_FPS = 24
export const FLIPBOOK_DURATION_SEC = FLIPBOOK_FRAMES / FLIPBOOK_FPS

export const EXPLOSION_SHEET_URL = '/assets/vfx/explosion_sheet.png'
export const SPARKS_SHEET_URL = '/assets/vfx/sparks_sheet.png'
export const WATERBURST_SHEET_URL = '/assets/vfx/waterburst_sheet.png'

const loader = new TextureLoader()
const cache = new Map<string, Texture>()

// 같은 텍스처를 여러 이펙트 인스턴스가 동시에 쓰면 offset을 서로 덮어써서 프레임이 꼬인다 —
// 로드는 한 번만 하고, 인스턴스마다 clone()해서 독립적인 offset/repeat을 가지게 한다.
export function loadFlipbookSheet(url: string): Texture {
  const cached = cache.get(url)
  if (cached) return cached
  const tex = loader.load(url)
  tex.repeat.set(1 / FLIPBOOK_COLS, 1 / FLIPBOOK_ROWS)
  cache.set(url, tex)
  return tex
}

export function preloadFlipbookSheets() {
  loadFlipbookSheet(EXPLOSION_SHEET_URL)
  loadFlipbookSheet(SPARKS_SHEET_URL)
  loadFlipbookSheet(WATERBURST_SHEET_URL)
}

export function setFlipbookFrame(texture: Texture, frame: number) {
  const f = Math.min(FLIPBOOK_FRAMES - 1, Math.max(0, Math.floor(frame)))
  const col = f % FLIPBOOK_COLS
  const row = Math.floor(f / FLIPBOOK_COLS)
  texture.offset.set(col / FLIPBOOK_COLS, 1 - (row + 1) / FLIPBOOK_ROWS)
}
