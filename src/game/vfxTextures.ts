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

// 탄착 화염: 하얀 코어 -> 주황 -> 짙은 적색으로 꺼져가는 불덩이.
export const fireTexture = radialTexture([
  [0, 'rgba(255,255,255,1)'],
  [0.15, 'rgba(255,221,140,1)'],
  [0.4, 'rgba(255,120,40,0.95)'],
  [0.7, 'rgba(190,40,20,0.45)'],
  [1, 'rgba(120,20,10,0)'],
])

// 포연: 밝은 회백색에서 바깥으로 갈수록 옅어지는 뭉게구름 — additive 없이 일반 알파 블렌딩으로
// 써야 진짜 연기처럼 보인다(additive로 쓰면 또 빛나는 덩어리가 됨).
export const smokeTexture = radialTexture([
  [0, 'rgba(233,229,221,0.95)'],
  [0.4, 'rgba(206,202,194,0.65)'],
  [0.75, 'rgba(170,168,162,0.28)'],
  [1, 'rgba(150,150,145,0)'],
])

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
