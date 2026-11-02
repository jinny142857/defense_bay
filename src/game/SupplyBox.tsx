import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Color, MeshStandardMaterial } from 'three'
import type { Group, Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'
import type { SupplyBoxType } from '../types'

const MODEL_URL = '/assets/supply-drop.glb'
const MODEL_SCALE = 0.22

// SupplyDrop.glb(SeaMobs_GameAssets)의 Beacon_Light로 상자 종류를 색으로 구분한다(PRD 3.3).
const BEACON_COLORS: Record<SupplyBoxType, Color> = {
  parts: new Color('#f2b22e'),
  bombard: new Color('#e5484d'),
  repair: new Color('#4fd1a1'),
}

const START_Y = 10

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
  const { scene } = useGLTF(MODEL_URL)
  const model = useMemo(() => scene.clone(true), [scene])
  const groupRef = useRef<Group>(null)
  const doneRef = useRef(false)
  const phase = useGameStore((s) => s.phase)
  const slow = useGameStore((s) => s.activeSupplyQuestion !== null)

  useEffect(() => {
    const beaconColor = BEACON_COLORS[boxType]
    model.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      if (mesh.name === 'Beacon_Light') {
        mesh.material = (mesh.material as MeshStandardMaterial).clone()
        const mat = mesh.material as MeshStandardMaterial
        mat.color.copy(beaconColor)
        mat.emissive.copy(beaconColor)
        mat.emissiveIntensity = 1.5
      }
    })
  }, [model, boxType])

  const fallSpeed = (START_Y - groundY) / balance.supplyBox.fallDurationSec

  useFrame((_, delta) => {
    if (doneRef.current || !groupRef.current) return
    if (phase === 'BOSS_INTRO') return
    const speedMul = slow ? 0.15 : 1
    groupRef.current.position.y -= fallSpeed * speedMul * delta
    if (groupRef.current.position.y <= groundY) {
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
    <group ref={groupRef} position={[startX, START_Y, startZ]} scale={MODEL_SCALE} onClick={handleClick}>
      <primitive object={model} />
    </group>
  )
}

useGLTF.preload(MODEL_URL)
