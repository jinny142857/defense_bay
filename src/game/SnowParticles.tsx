import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Points, PointsMaterial } from 'three'

const COUNT = 320
const AREA_X = 90
const AREA_Z_MIN = -160
const AREA_Z_MAX = 40
const HEIGHT_MIN = 6
const HEIGHT_MAX = 70
const FALL_SPEED_MIN = 1.5
const FALL_SPEED_MAX = 3.2
const FLOOR_Y = -5

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min)
}

// 스테이지 3(설원 바다) 전용 — 빗소리/빗방울 대신 천천히 흩날리는 눈송이(SeaEnvironment 가이드:
// "작고 느리고 바람에 살짝 옆으로"). 아래로 떨어지다 바닥 밑으로 내려가면 다시 위에서 리스폰한다.
export function SnowParticles() {
  const pointsRef = useRef<Points>(null)
  const velocitiesRef = useRef<Float32Array | null>(null)
  const phasesRef = useRef<Float32Array | null>(null)

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const velocities = new Float32Array(COUNT)
    const phases = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = randRange(-AREA_X, AREA_X)
      positions[i * 3 + 1] = randRange(HEIGHT_MIN, HEIGHT_MAX)
      positions[i * 3 + 2] = randRange(AREA_Z_MIN, AREA_Z_MAX)
      velocities[i] = randRange(FALL_SPEED_MIN, FALL_SPEED_MAX)
      phases[i] = Math.random() * Math.PI * 2
    }
    velocitiesRef.current = velocities
    phasesRef.current = phases

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))

    const mat = new PointsMaterial({
      // 순백(0xffffff)은 밝은 설원 하늘을 배경으로 거의 안 보여서, 살짝 그림자 진 흰색을 쓴다.
      color: 0xdfe8ee,
      size: 0.45,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: true,
      depthWrite: false,
    })
    return { geometry: geo, material: mat }
  }, [])

  useFrame(({ clock }, delta) => {
    const points = pointsRef.current
    const velocities = velocitiesRef.current
    const phases = phasesRef.current
    if (!points || !velocities || !phases) return
    const posAttr = points.geometry.getAttribute('position') as BufferAttribute
    const arr = posAttr.array as Float32Array
    const t = clock.getElapsedTime()

    for (let i = 0; i < COUNT; i++) {
      const idx = i * 3
      let y = arr[idx + 1] - velocities[i] * delta
      if (y < FLOOR_Y) {
        y = HEIGHT_MAX
        arr[idx] = randRange(-AREA_X, AREA_X)
        arr[idx + 2] = randRange(AREA_Z_MIN, AREA_Z_MAX)
      }
      arr[idx + 1] = y
      // 바람에 살짝 옆으로: 일정한 바람 + 사인 흔들림
      arr[idx] += (0.08 + Math.sin(t * 0.6 + phases[i]) * 0.15) * delta
    }
    posAttr.needsUpdate = true
  })

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
}
