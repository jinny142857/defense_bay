import { CanvasTexture } from 'three'

// 머즐플래시/탄착/연기를 전부 평평한 구체(sphereGeometry)로 그리면 입체감 없는 "색칠된 공"으로밖에
// 안 보인다 — 실제 불꽃/연기처럼 보이려면 가장자리가 부드럽게 번지는 그라디언트 텍스처를 카메라를
// 향하는 스프라이트에 입혀야 한다. 매번 캔버스를 새로 그리지 않도록 모듈 로드 시 한 번만 만들어
// 재사용한다(3D 모델/Blender 작업이 아니라 순수 캔버스 텍스처라 가볍다).
function radialTexture(stops: [number, string][], size = 128) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [offset, color] of stops) grad.addColorStop(offset, color)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

// 머즐 플래시: 중심이 새하얗게 타들어가고 바깥으로 주황빛이 번지는 별 모양 섬광.
export const flashTexture = radialTexture([
  [0, 'rgba(255,255,255,1)'],
  [0.18, 'rgba(255,241,204,0.95)'],
  [0.45, 'rgba(255,176,80,0.55)'],
  [1, 'rgba(255,140,40,0)'],
])

// 탄착 화염: 하얀 코어 -> 주황 -> 짙은 적색으로 꺼져가는 불덩이. 하얀 부분을 작게 눌러 중심부만
// 밝고 나머지는 또렷한 주황/적색이 넓게 퍼지도록 해서 옅은 하늘 배경에서도 "불" 색이 확실히
// 읽히게 한다(하얀 비중이 크면 옅은 회색 안개처럼 번져 보인다).
export const fireTexture = radialTexture([
  [0, 'rgba(255,255,255,1)'],
  [0.08, 'rgba(255,214,120,1)'],
  [0.3, 'rgba(255,140,30,1)'],
  [0.6, 'rgba(224,60,20,0.65)'],
  [0.85, 'rgba(150,25,12,0.3)'],
  [1, 'rgba(120,20,10,0)'],
])

// 깔끔한 원 하나짜리 radialTexture는 아무리 색을 바꿔도 "동그란 공"처럼 보인다 — 진짜 뭉게구름
// 같은 디테일을 내려면 울퉁불퉁한 윤곽이 필요하다. 작은 퍼프(radial gradient 덩어리) 여러 개를
// 무작위 위치/크기로 겹쳐 그려서 한 텍스처 안에 울퉁불퉁한 뭉게구름 실루엣을 만든다.
function cloudTexture(stops: [number, string][], seed: number, size = 160) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  // 간단한 시드 기반 의사난수 — 실행마다 모양이 바뀌지 않고 인스턴스별로만 다르게 고정된다.
  let s = seed
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  const puffCount = 6
  for (let i = 0; i < puffCount; i++) {
    const angle = rand() * Math.PI * 2
    const dist = rand() * size * 0.22
    const cx = size / 2 + Math.cos(angle) * dist
    const cy = size / 2 + Math.sin(angle) * dist
    const r = size * (0.32 + rand() * 0.26)
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    for (const [offset, color] of stops) grad.addColorStop(offset, color)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

// 포연: 짙은 회갈색 그을음 구름 — additive 없이 일반 알파 블렌딩으로 써야 진짜 연기처럼 보인다
// (additive로 쓰면 또 빛나는 덩어리가 됨). 이 게임의 하늘이 전반적으로 옅은 회백색이라, 연기도
// 밝은 회백색으로 만들면 배경에 묻혀 안 보인다 — 하늘보다 뚜렷이 짙은 톤으로 대비를 준다.
const SMOKE_STOPS: [number, string][] = [
  [0, 'rgba(92,86,78,0.95)'],
  [0.4, 'rgba(70,65,58,0.75)'],
  [0.75, 'rgba(52,48,44,0.4)'],
  [1, 'rgba(40,38,35,0)'],
]
// 스프라이트마다 다른 모양을 쓰도록 몇 가지 변형을 미리 만들어 둔다(전부 같은 동그라미면
// 여러 개를 겹쳐도 티가 난다).
export const smokeTextures = [
  cloudTexture(SMOKE_STOPS, 11),
  cloudTexture(SMOKE_STOPS, 47),
  cloudTexture(SMOKE_STOPS, 83),
  cloudTexture(SMOKE_STOPS, 129),
]

// 작고 밝은 불씨 파편 — 탄착 스파크용.
export const emberTexture = radialTexture([
  [0, 'rgba(255,255,255,1)'],
  [0.3, 'rgba(255,200,120,1)'],
  [1, 'rgba(255,120,40,0)'],
])

// 포탄 궤적(예광탄) 빛줄기 — 길쭉하게 늘인 평면에 입혀서 중심이 하얗게 밝고 양 끝이 사라지는
// 빛줄기로 보이게 한다.
export const beamTexture = (() => {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 32
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, 128, 0)
  grad.addColorStop(0, 'rgba(255,214,122,0)')
  grad.addColorStop(0.12, 'rgba(255,214,122,0.85)')
  grad.addColorStop(0.5, 'rgba(255,255,255,1)')
  grad.addColorStop(0.88, 'rgba(255,214,122,0.85)')
  grad.addColorStop(1, 'rgba(255,214,122,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 128, 32)
  // 위아래로도 살짝 부드럽게 깎아내서 각진 사각형 티가 안 나게 한다.
  const vgrad = ctx.createLinearGradient(0, 0, 0, 32)
  vgrad.addColorStop(0, 'rgba(0,0,0,1)')
  vgrad.addColorStop(0.5, 'rgba(0,0,0,0)')
  vgrad.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = vgrad
  ctx.fillRect(0, 0, 128, 32)
  const tex = new CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
})()
