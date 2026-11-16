import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import type { Group } from 'three'

const LIFETIME_SEC = 1.1
const RISE_DISTANCE = 1.8
// UI(index.css)와 같은 헤드라인 폰트를 써서 troika-three-text 기본 서체보다 게임 톤에 맞게 한다.
const POPUP_FONT = 'https://cdn.jsdelivr.net/gh/yellopencil/yellopencil-webfonts@v1.48.0/fonts/chai-hwaljjak/ChaiHwaljjak-Bold.ttf'
const DEFAULT_FONT_SIZE = 1.4

// 명중/처치 시 떠오르는 숫자 팝업(PRD 7.4 "피격 숫자", 5.2 보스 약점 크리티컬 숫자).
// 일반 몹은 처치 보상(+점수), 보스는 실제 데미지 수치를 보여준다.
export function DamagePopup({
  position,
  text,
  color,
  fontSize = DEFAULT_FONT_SIZE,
  onDone,
}: {
  position: [number, number, number]
  text: string
  color: string
  // "재장전 중"처럼 데미지 숫자가 아닌 안내 문구는 작게 — 숫자 팝업과 같은 크기면 너무 크게 보인다.
  fontSize?: number
  onDone: () => void
}) {
  const [age, setAge] = useState(0)
  const groupRef = useRef<Group>(null)

  useFrame((_, delta) => {
    const next = age + delta
    setAge(next)
    if (groupRef.current) {
      const t = Math.min(1, next / LIFETIME_SEC)
      groupRef.current.position.y = position[1] + t * RISE_DISTANCE
    }
    if (next >= LIFETIME_SEC) onDone()
  })

  const fade = Math.max(0, 1 - age / LIFETIME_SEC)

  return (
    <group ref={groupRef} position={position}>
      <Billboard>
        <Text
          font={POPUP_FONT}
          fontSize={fontSize}
          color={color}
          outlineWidth={0.09}
          outlineColor="#1a1410"
          fillOpacity={fade}
          outlineOpacity={fade}
        >
          {text}
        </Text>
      </Billboard>
    </group>
  )
}
