import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import { Color } from 'three'
import type { Group } from 'three'

// "바가 너무 커졌다" 피드백 — 이전(1.15/0.18)보다 한 단계 작게 되돌린다.
const BAR_WIDTH = 0.8
const BAR_HEIGHT = 0.11
const POP_DURATION_SEC = 0.35
const FULL_COLOR = new Color('#ffd23f') // 노란색(가득 참)
const EMPTY_COLOR = new Color('#ff3b30') // 빨간색(거의 다 닳음)
const fillColor = new Color()

// 일반 몹도 여러 방 맞아야 처치되므로(PRD 4.4 확장) 보스처럼 체력바를 띄운다. 풀피일 때는
// 화면이 지저분해지지 않도록 숨기고, 처음 맞았을 때부터 나타난다.
// "맞았다는 느낌이 안 든다"는 피드백 — depthTest를 꺼서 몹 모델 지오메트리에 가려 안 보이는 일이
// 없게 하고, 테두리를 밝게 둬서 배경과 대비를 주고, 맞을 때마다 살짝 튀어오르는 펄스를 넣었다.
// 예전 버그: 채움 막대만 transparent를 안 줘서 불투명(opaque) 패스에 들어갔다 — opaque 패스는
// depthTest가 켜진 채 먼저 그려지고, 그 위에 depthTest={false}인 배경판이 나중에 깔리면서
// 채움 막대를 완전히 덮어버려 "줄지 않는 검은 바"로만 보였다. 세 판 전부 transparent로 맞춰서
// 같은 렌더 패스/순서 안에서 그려지게 한다.
export function MobHealthBar({ hpRatio, yOffset }: { hpRatio: number; yOffset: number }) {
  const groupRef = useRef<Group>(null)
  const pulseRef = useRef(0)
  const prevRatioRef = useRef(hpRatio)
  const ratio = useMemo(() => Math.max(0, Math.min(1, hpRatio)), [hpRatio])
  // 가득 찼을 땐 노란색, 거의 닳으면 빨간색으로 — "줄어드는 게 눈에 보여야" 한다는 피드백.
  const barColor = useMemo(() => fillColor.clone().lerpColors(EMPTY_COLOR, FULL_COLOR, ratio), [ratio])

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

  return (
    <Billboard ref={groupRef} position={[0, yOffset, 0]}>
      <mesh position={[0, 0, -0.002]} renderOrder={998}>
        <planeGeometry args={[BAR_WIDTH + 0.06, BAR_HEIGHT + 0.06]} />
        <meshBasicMaterial color="#2b2a26" transparent opacity={0.95} depthTest={false} />
      </mesh>
      <mesh position={[0, 0, -0.001]} renderOrder={999}>
        <planeGeometry args={[BAR_WIDTH + 0.02, BAR_HEIGHT + 0.02]} />
        <meshBasicMaterial color="#12181a" transparent opacity={0.95} depthTest={false} />
      </mesh>
      {/* 예전 버그: 이 채움 막대에만 transparent가 없어서 불투명(opaque) 패스로 먼저 그려졌고,
          그 위로 depthTest={false}인 배경판이 나중에 덮어버려 "줄지 않는 검은 바"로 보였다.
          transparent를 줘서 배경판과 같은 패스/순서 안에서 맨 위에 그려지게 한다. */}
      <mesh position={[-(BAR_WIDTH * (1 - ratio)) / 2, 0, 0]} renderOrder={1000}>
        <planeGeometry args={[Math.max(0.001, BAR_WIDTH * ratio), BAR_HEIGHT]} />
        <meshBasicMaterial color={barColor} transparent depthTest={false} />
      </mesh>
    </Billboard>
  )
}
