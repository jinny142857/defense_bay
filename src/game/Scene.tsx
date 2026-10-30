import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Vector3 } from 'three'
import { Ocean } from './Ocean'
import { Breakwater } from './Breakwater'
import { Turret } from './Turret'
import { Crab } from './Crab'
import { SupplyBox } from './SupplyBox'
import { Boss } from './Boss'
import { Projectile } from './Projectile'
import { balance } from '../config/balance'
import { WEAPON_DEFS } from '../data/weapons'
import { useGameStore } from '../state/gameStore'
import type { SupplyBoxType } from '../types'

const WALL_Z = -6
const SPAWN_Z = -55
const BOX_Z = -16
const BOX_GROUND_Y = -0.5
const MUZZLE: [number, number, number] = [0, 0.3, -4.3]
const CAMERA_HOME = new Vector3(0, 1.2, 0)
const CAMERA_BOSS = new Vector3(0, 2, -8)

interface CrabEntity {
  id: string
  startX: number
}

interface BoxEntity {
  id: string
  boxType: SupplyBoxType
  startX: number
}

interface Tracer {
  id: string
  from: [number, number, number]
  to: [number, number, number]
}

function Spawner({ onSpawn }: { onSpawn: () => void }) {
  const timer = useRef(0)
  const spawnedCount = useRef(0)
  const crabsTotal = useGameStore((s) => s.crabsTotal)
  const phase = useGameStore((s) => s.phase)

  useFrame((_, delta) => {
    if (phase !== 'COMBAT' || spawnedCount.current >= crabsTotal) return
    timer.current += delta
    if (timer.current >= balance.combat.crabSpawnIntervalSec) {
      timer.current = 0
      spawnedCount.current += 1
      onSpawn()
    }
  })

  return null
}

function SupplyBoxSpawner({ onSpawn }: { onSpawn: (type: SupplyBoxType) => void }) {
  const phase = useGameStore((s) => s.phase)
  const targetCount = useRef(
    balance.supplyBox.spawnMinPerWave +
      Math.floor(Math.random() * (balance.supplyBox.spawnMaxPerWave - balance.supplyBox.spawnMinPerWave + 1)),
  )
  const spawnedCount = useRef(0)
  const timer = useRef(Math.random() * 4 + 3)

  useFrame((_, delta) => {
    if (phase !== 'COMBAT' || spawnedCount.current >= targetCount.current) return
    timer.current -= delta
    if (timer.current <= 0) {
      spawnedCount.current += 1
      const types: SupplyBoxType[] = ['parts', 'bombard', 'repair']
      onSpawn(types[Math.floor(Math.random() * types.length)])
      timer.current = Math.random() * 5 + 4
    }
  })

  return null
}

function CameraRig() {
  const { camera } = useThree()
  const phase = useGameStore((s) => s.phase)

  useEffect(() => {
    camera.position.set(0, 1.2, 0)
    camera.lookAt(0, 1, -10)
  }, [camera])

  useFrame(() => {
    const target = phase === 'BOSS_INTRO' ? CAMERA_BOSS : CAMERA_HOME
    camera.position.lerp(target, phase === 'BOSS_INTRO' ? 0.03 : 0.05)
    camera.lookAt(0, phase === 'BOSS_INTRO' ? 1.5 : 1, phase === 'BOSS_INTRO' ? -22 : -10)
  })

  return null
}

function SceneContents() {
  const [crabs, setCrabs] = useState<CrabEntity[]>([])
  const [boxes, setBoxes] = useState<BoxEntity[]>([])
  const [tracers, setTracers] = useState<Tracer[]>([])
  const defeatCrab = useGameStore((s) => s.defeatCrab)
  const crabReachedBreakwater = useGameStore((s) => s.crabReachedBreakwater)
  const openSupplyBox = useGameStore((s) => s.openSupplyBox)
  const damageBoss = useGameStore((s) => s.damageBoss)
  const waveNumber = useGameStore((s) => s.waveNumber)
  const bossActive = useGameStore((s) => s.bossActive)
  const bombardPulse = useGameStore((s) => s.supplyBombardPulse)
  const fireRateBuffPct = useGameStore((s) => s.fireRateBuffPct)
  const equippedWeaponId = useGameStore((s) => s.equippedWeaponId)
  const infiniteReloadUntil = useGameStore((s) => s.infiniteReloadUntil)
  const nextId = useRef(0)
  const lastShotAtRef = useRef(0)

  useEffect(() => {
    if (bombardPulse === 0) return
    const count = crabs.length
    if (count === 0) return
    setCrabs([])
    for (let i = 0; i < count; i++) defeatCrab()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bombardPulse])

  const tryFire = (): boolean => {
    const now = Date.now()
    if (now < infiniteReloadUntil) {
      lastShotAtRef.current = now
      return true
    }
    const weapon = WEAPON_DEFS[equippedWeaponId]
    const fireRate = weapon.baseFireRate * (1 + fireRateBuffPct)
    const intervalMs = 1000 / Math.max(0.1, fireRate)
    if (now - lastShotAtRef.current < intervalMs) return false
    lastShotAtRef.current = now
    return true
  }

  const spawnCrab = () => {
    const id = `crab-${nextId.current++}`
    const startX = (Math.random() - 0.5) * 10
    setCrabs((list) => [...list, { id, startX }])
  }

  const spawnBox = (boxType: SupplyBoxType) => {
    const id = `box-${nextId.current++}`
    const startX = (Math.random() - 0.5) * 8
    setBoxes((list) => [...list, { id, boxType, startX }])
  }

  const addTracer = (to: [number, number, number]) => {
    const id = `tracer-${nextId.current++}`
    setTracers((list) => [...list, { id, from: MUZZLE, to }])
  }

  const handleMiss = (e: ThreeEvent<PointerEvent>) => {
    if (!tryFire()) return
    const p = e.point
    addTracer([p.x, p.y, p.z])
  }

  return (
    <>
      <CameraRig />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />
      <Spawner onSpawn={spawnCrab} />
      <SupplyBoxSpawner onSpawn={spawnBox} />
      <Ocean onPointerDown={handleMiss} />
      <Breakwater />
      <Turret />
      {waveNumber === 3 && bossActive && (
        <Boss
          onHit={(targetWeak) => {
            if (!tryFire()) return
            damageBoss(targetWeak)
          }}
        />
      )}
      {crabs.map((c) => (
        <Crab
          key={c.id}
          startX={c.startX}
          startZ={SPAWN_Z}
          wallZ={WALL_Z}
          onHit={(point) => {
            if (!tryFire()) return false
            addTracer(point)
            setCrabs((list) => list.filter((x) => x.id !== c.id))
            defeatCrab()
            return true
          }}
          onReachWall={() => {
            setCrabs((list) => list.filter((x) => x.id !== c.id))
            crabReachedBreakwater()
          }}
        />
      ))}
      {boxes.map((b) => (
        <SupplyBox
          key={b.id}
          boxType={b.boxType}
          startX={b.startX}
          startZ={BOX_Z}
          groundY={BOX_GROUND_Y}
          onCatch={() => {
            if (!tryFire()) return false
            setBoxes((list) => list.filter((x) => x.id !== b.id))
            openSupplyBox(b.boxType)
            return true
          }}
          onLost={() => {
            setBoxes((list) => list.filter((x) => x.id !== b.id))
          }}
        />
      ))}
      {tracers.map((t) => (
        <Projectile
          key={t.id}
          from={t.from}
          to={t.to}
          onDone={() => setTracers((list) => list.filter((x) => x.id !== t.id))}
        />
      ))}
    </>
  )
}

export function Scene() {
  return (
    <Canvas camera={{ position: [0, 1.2, 0], fov: 60 }} shadows>
      <SceneContents />
    </Canvas>
  )
}
