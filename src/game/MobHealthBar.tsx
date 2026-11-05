import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import type { Group } from 'three'

const BAR_WIDTH = 1.15
const BAR_HEIGHT = 0.18
const POP_DURATION_SEC = 0.35

// 일반 몹도 여러 방 맞아야 처치되므로(PRD 4.4 확장) 보스처럼 체력바를 띄운다. 풀피일 때는
// 화면이 지저분해지지 않도록 숨기고, 처음 맞았을 때부터 나타난다.
// "맞았다는 느낌이 안 든다"는 피드백 — depthTest를 꺼서 몹 모델 지오메트리에 가려 안 보이는 일이
// 없게 하고, 테두리를 밝게 둬서 배경과 대비를 주고, 맞을 때마다 살짝 튀어오르는 펄스를 넣었다.
export function MobHealthBar({ hpRatio, yOffset }: { hpRatio: number; yOffset: number }) {
  const groupRef = useRef<Group>(null)
  const pulseRef = useRef(0)
  const prevRatioRef = useRef(hpRatio)

  useEffect(() => {
    if (hpRatio < prevRatioRef.current) pulseRef.current = POP_DURATION_SEC
    prevRatioRef.current = hpRatio
  }, [hpRatio])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    if (pulseRef.current > 0) {
      pulseRef.current = Math.max(0, pulseRef.current - delta)
      const t = pulseRef.current / POP_DURATION_SEC
      groupRef.current.scale.setScalar(1 + t * 0.6)
    } else {
      groupRef.current.scale.setScalar(1)
    }
  })

  if (hpRatio >= 1) return null
  const ratio = Math.max(0, Math.min(1, hpRatio))

  return (
    <Billboard ref={groupRef} position={[0, yOffset, 0]}>
      <mesh position={[0, 0, -0.002]} renderOrder={998}>
        <planeGeometry args={[BAR_WIDTH + 0.1, BAR_HEIGHT + 0.1]} />
        <meshBasicMaterial color="#f2b22e" transparent opacity={0.9} depthTest={false} />
      </mesh>
      <mesh position={[0, 0, -0.001]} renderOrder={999}>
        <planeGeometry args={[BAR_WIDTH + 0.04, BAR_HEIGHT + 0.04]} />
        <meshBasicMaterial color="#12181a" transparent opacity={0.95} depthTest={false} />
      </mesh>
      <mesh position={[-(BAR_WIDTH * (1 - ratio)) / 2, 0, 0]} renderOrder={1000}>
        <planeGeometry args={[Math.max(0.001, BAR_WIDTH * ratio), BAR_HEIGHT]} />
        <meshBasicMaterial color="#ff5a4d" depthTest={false} />
      </mesh>
    </Billboard>
  )
}
