import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'
import type { SupplyBoxType } from '../types'

const COLORS: Record<SupplyBoxType, string> = {
  parts: '#f2b22e',
  bombard: '#e5484d',
  repair: '#4fd1a1',
}

const START_Y = 10

// M1 임시 도형: 실제 낙하산 보급상자 모델(PRD 7.4)은 이후 마일스톤에서 GLB로 교체한다.
export function SupplyBox({
  boxType,
  startX,
  startZ,
  groundY,
  onCatch,
  onLost,
}: {
  boxType: SupplyBoxType
  startX: number
  startZ: number
  groundY: number
  onCatch: () => boolean
  onLost: () => void
}) {
  const meshRef = useRef<Mesh>(null)
  const doneRef = useRef(false)
  const phase = useGameStore((s) => s.phase)
  const slow = useGameStore((s) => s.activeSupplyQuestion !== null)

  const fallSpeed = (START_Y - groundY) / balance.supplyBox.fallDurationSec

  useFrame((_, delta) => {
    if (doneRef.current || !meshRef.current) return
    if (phase === 'BOSS_INTRO') return
    const speedMul = slow ? 0.15 : 1
    meshRef.current.position.y -= fallSpeed * speedMul * delta
    if (meshRef.current.position.y <= groundY) {
      doneRef.current = true
      onLost()
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (doneRef.current) return
    if (onCatch()) doneRef.current = true
  }

  return (
    <mesh ref={meshRef} position={[startX, START_Y, startZ]} onClick={handleClick} castShadow>
      <boxGeometry args={[0.6, 0.6, 0.6]} />
      <meshStandardMaterial
        color={COLORS[boxType]}
        emissive={COLORS[boxType]}
        emissiveIntensity={0.3}
      />
    </mesh>
  )
}
