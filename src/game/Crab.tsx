import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { balance } from '../config/balance'
import { useGameStore } from '../state/gameStore'

// M1 임시 도형: 실제 꼬마 게 모델(PRD 7.4)은 이후 마일스톤에서 GLB로 교체한다.
export function Crab({
  startX,
  startZ,
  wallZ,
  onReachWall,
  onHit,
}: {
  startX: number
  startZ: number
  wallZ: number
  onReachWall: () => void
  onHit: (point: [number, number, number]) => boolean
}) {
  const meshRef = useRef<Mesh>(null)
  const doneRef = useRef(false)
  const phase = useGameStore((s) => s.phase)
  const slow = useGameStore((s) => s.activeSupplyQuestion !== null)

  useFrame((_, delta) => {
    if (doneRef.current || !meshRef.current) return
    if (phase === 'BOSS_INTRO') return
    const speedMul = slow ? 0.15 : 1
    meshRef.current.position.z += balance.combat.crabSpeed * speedMul * delta
    if (meshRef.current.position.z >= wallZ) {
      doneRef.current = true
      onReachWall()
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (doneRef.current || !meshRef.current) return
    const p = meshRef.current.position
    // 쿨다운에 막혀 발사가 거부된 경우 done 처리하지 않아야 다음 클릭에 다시 맞출 수 있다
    // (거부된 클릭에서 done을 먼저 세우면 개체가 영구히 멈춘 채 반응 없는 상태로 남는 버그가 있었음)
    if (onHit([p.x, p.y, p.z])) doneRef.current = true
  }

  return (
    <mesh ref={meshRef} position={[startX, -0.6, startZ]} castShadow onClick={handleClick}>
      <boxGeometry args={[0.8, 0.4, 0.8]} />
      <meshStandardMaterial color="#d4572a" />
    </mesh>
  )
}
