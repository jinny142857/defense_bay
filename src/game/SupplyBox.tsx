import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Box3, Color, MeshStandardMaterial } from 'three'
import type { Group, Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useGameStore } from '../state/gameStore'
import { balance } from '../config/balance'
import { raycastTargets } from './raycastRegistry'
import { getWaveHeight } from './SeaWater.js'
import type { SupplyBoxType } from '../types'

const MODEL_URL = '/assets/supply-drop.glb'
const MODEL_SCALE = 0.22
// 수면에 닿으면 바로 사라지지 않고 파도에 떠서 흔들리다가, 그래도 안 주우면 그제서야 사라진다.
const FLOAT_LIFETIME_SEC = 7

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
  onCatch: (point: [number, number, number]) => boolean
  onLost: () => void
}) {
  const { scene } = useGLTF(MODEL_URL)
  const model = useMemo(() => scene.clone(true), [scene])
  // 모델의 피벗(원점)이 튜브/상자 바닥과 정확히 일치하지 않는다 — 튜브(Float_Ring/Float_Band)가
  // 먼저 수면에 닿아야 한다는 피드백이라, 실제 지오메트리의 최하단을 재서 그 지점이 수면에 오도록
  // 보정한다(하드코딩된 오프셋 대신 모델 자체를 기준으로 삼아 모델이 바뀌어도 안 틀어진다).
  const bottomOffset = useMemo(() => new Box3().setFromObject(model).min.y, [model])
  const groupRef = useRef<Group>(null)
  const doneRef = useRef(false)
  const phase = useGameStore((s) => s.phase)
  const slow = useGameStore((s) => s.activeSupplyQuestion !== null)

  useEffect(() => {
    const g = groupRef.current
    if (!g) return
    raycastTargets.add(g)
    return () => {
      raycastTargets.delete(g)
    }
  }, [])

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

  // 모델 바닥(튜브)이 groundY(수면)에 오도록, 피벗 기준 목표 Y를 보정한다.
  const restY = groundY - bottomOffset * MODEL_SCALE
  const fallSpeed = (START_Y - restY) / balance.supplyBox.fallDurationSec
  const floatingRef = useRef(false)
  const floatAgeRef = useRef(0)

  useFrame(({ clock }, delta) => {
    if (doneRef.current || !groupRef.current) return
    if (phase === 'BOSS_INTRO') return
    const speedMul = slow ? 0.15 : 1

    if (!floatingRef.current) {
      groupRef.current.position.y -= fallSpeed * speedMul * delta
      if (groupRef.current.position.y <= restY) {
        floatingRef.current = true
        groupRef.current.position.y = restY
      }
      return
    }

    // 수면 도달 후: 사라지지 않고 파도를 따라 둥둥 떠 있다가, 한참 안 주우면 그제서야 사라진다.
    floatAgeRef.current += delta * speedMul
    groupRef.current.position.y = getWaveHeight(startX, startZ, clock.getElapsedTime()) + restY
    if (floatAgeRef.current >= FLOAT_LIFETIME_SEC) {
      doneRef.current = true
      onLost()
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (doneRef.current) return
    const point: [number, number, number] = [e.point.x, e.point.y, e.point.z]
    if (onCatch(point)) doneRef.current = true
  }

  return (
    <group
      ref={groupRef}
      position={[startX, START_Y, startZ]}
      scale={MODEL_SCALE}
      onClick={handleClick}
      userData={{ hittable: true }}
    >
      <primitive object={model} />
      {/* 모델 자체는 작고 낙하 중엔 빠르게 움직여 정확히 맞히기 어렵다는 피드백 — 보이지는
          않지만 넉넉한 구 모양 히트박스를 겹쳐 둬서 클릭 판정을 관대하게 한다. */}
      <mesh>
        <sphereGeometry args={[5, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

useGLTF.preload(MODEL_URL)
