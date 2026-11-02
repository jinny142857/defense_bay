import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { Group, Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { balance } from '../config/balance'
import { useGameStore } from '../state/gameStore'

const MODEL_URL = '/assets/crab.glb'
const MODEL_SCALE = 0.42
const GROUND_Y = -0.8

// 실제 꼬마 게 몬스터 모델(PRD 7.4, Blender MCP로 제작). 집게/눈자루가 +Z(전진 방향)를 향하도록 내보냈다.
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
  const { scene } = useGLTF(MODEL_URL)
  const model = useMemo(() => scene.clone(true), [scene])
  const groupRef = useRef<Group>(null)
  const doneRef = useRef(false)
  const phase = useGameStore((s) => s.phase)
  const slow = useGameStore((s) => s.activeSupplyQuestion !== null)

  useEffect(() => {
    model.traverse((obj) => {
      if ((obj as Mesh).isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })
  }, [model])

  useFrame((_, delta) => {
    if (doneRef.current || !groupRef.current) return
    if (phase === 'BOSS_INTRO') return
    const speedMul = slow ? 0.15 : 1
    groupRef.current.position.z += balance.combat.crabSpeed * speedMul * delta
    if (groupRef.current.position.z >= wallZ) {
      doneRef.current = true
      onReachWall()
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (doneRef.current || !groupRef.current) return
    const p = groupRef.current.position
    // 쿨다운에 막혀 발사가 거부된 경우 done 처리하지 않아야 다음 클릭에 다시 맞출 수 있다
    // (거부된 클릭에서 done을 먼저 세우면 개체가 영구히 멈춘 채 반응 없는 상태로 남는 버그가 있었음)
    if (onHit([p.x, p.y, p.z])) doneRef.current = true
  }

  return (
    <group ref={groupRef} position={[startX, GROUND_Y, startZ]} scale={MODEL_SCALE} onClick={handleClick}>
      <primitive object={model} />
    </group>
  )
}

useGLTF.preload(MODEL_URL)
