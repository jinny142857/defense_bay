import { Billboard } from '@react-three/drei'

const BAR_WIDTH = 0.9
const BAR_HEIGHT = 0.12

// 일반 몹도 여러 방 맞아야 처치되므로(PRD 4.4 확장) 보스처럼 체력바를 띄운다. 풀피일 때는
// 화면이 지저분해지지 않도록 숨기고, 처음 맞았을 때부터 나타난다.
export function MobHealthBar({ hpRatio, yOffset }: { hpRatio: number; yOffset: number }) {
  if (hpRatio >= 1) return null
  const ratio = Math.max(0, Math.min(1, hpRatio))

  return (
    <Billboard position={[0, yOffset, 0]}>
      <mesh position={[0, 0, -0.001]}>
        <planeGeometry args={[BAR_WIDTH + 0.05, BAR_HEIGHT + 0.05]} />
        <meshBasicMaterial color="#12181a" transparent opacity={0.8} />
      </mesh>
      <mesh position={[-(BAR_WIDTH * (1 - ratio)) / 2, 0, 0]}>
        <planeGeometry args={[Math.max(0.001, BAR_WIDTH * ratio), BAR_HEIGHT]} />
        <meshBasicMaterial color="#e5484d" />
      </mesh>
    </Billboard>
  )
}
