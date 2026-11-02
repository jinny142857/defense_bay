import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Vector3 } from 'three'
import { Sea } from './Sea'
import { Mountains } from './Mountains'
import { SEA_FOG, SUN_DIRECTION } from './SeaWater.js'
import { Breakwater } from './Breakwater'
import { Turret } from './Turret'
import { Mob } from './Mob'
import { SupplyBox } from './SupplyBox'
import { Boss } from './Boss'
import { Projectile } from './Projectile'
import { MuzzleFlash } from './MuzzleFlash'
import { triggerFireSignal } from './fireSignal'
import { balance } from '../config/balance'
import { WEAPON_DEFS } from '../data/weapons'
import { useGameStore } from '../state/gameStore'
import type { MobKind, SupplyBoxType } from '../types'

// SeaEnvironment_GameAssets 가이드 좌표계: 원점 = 방파제/플레이어, 바다 쪽 = -Z, 1 unit = 1m
const MOB_SPAWN_X_SPREAD = 300
const MOB_SPAWN_Z_MIN = 600
const MOB_SPAWN_Z_MAX = 800
const BOX_Z = -16
const BOX_GROUND_Y = -0.5
const MUZZLE: [number, number, number] = [0, 1.63, -8.3]
// 위에서 내려다보는 각도는 유지하고, 카메라를 탱크 쪽으로 더 앞으로 당긴다.
const CAMERA_HOME = new Vector3(0, 2.6, -3.3)
const CAMERA_HOME_LOOK: [number, number, number] = [0, 2.5, -20]
const CAMERA_BOSS = new Vector3(0, 2.8, -8)
const SUN_POSITION = SUN_DIRECTION.clone().multiplyScalar(500)

interface MobEntity {
  id: string
  kind: MobKind
  startX: number
  startZ: number
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
    camera.position.copy(CAMERA_HOME)
    camera.lookAt(...CAMERA_HOME_LOOK)
  }, [camera])

  useFrame(() => {
    const target = phase === 'BOSS_INTRO' ? CAMERA_BOSS : CAMERA_HOME
    camera.position.lerp(target, phase === 'BOSS_INTRO' ? 0.03 : 0.05)
    if (phase === 'BOSS_INTRO') {
      camera.lookAt(0, 1.5, -22)
    } else {
      camera.lookAt(...CAMERA_HOME_LOOK)
    }
  })

  return null
}

function SceneContents() {
  const [mobs, setMobs] = useState<MobEntity[]>([])
  const [boxes, setBoxes] = useState<BoxEntity[]>([])
  const [tracers, setTracers] = useState<Tracer[]>([])
  const [flashes, setFlashes] = useState<{ id: string }[]>([])
  const defeatCrab = useGameStore((s) => s.defeatCrab)
  const crabReachedBreakwater = useGameStore((s) => s.crabReachedBreakwater)
  const openSupplyBox = useGameStore((s) => s.openSupplyBox)
  const damageBoss = useGameStore((s) => s.damageBoss)
  const waveNumber = useGameStore((s) => s.waveNumber)
  const bossTriggered = useGameStore((s) => s.bossTriggered)
  const bombardPulse = useGameStore((s) => s.supplyBombardPulse)
  const fireRateBuffPct = useGameStore((s) => s.fireRateBuffPct)
  const equippedWeaponId = useGameStore((s) => s.equippedWeaponId)
  const infiniteReloadUntil = useGameStore((s) => s.infiniteReloadUntil)
  const nextId = useRef(0)
  const lastShotAtRef = useRef(0)

  useEffect(() => {
    if (bombardPulse === 0) return
    const count = mobs.length
    if (count === 0) return
    setMobs([])
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

  const spawnMob = () => {
    const id = `mob-${nextId.current++}`
    const startX = (Math.random() - 0.5) * MOB_SPAWN_X_SPREAD
    const startZ = -(MOB_SPAWN_Z_MIN + Math.random() * (MOB_SPAWN_Z_MAX - MOB_SPAWN_Z_MIN))
    const kind: MobKind = Math.random() < 0.5 ? 'crab' : 'frogTurtle'
    setMobs((list) => [...list, { id, kind, startX, startZ }])
  }

  const spawnBox = (boxType: SupplyBoxType) => {
    const id = `box-${nextId.current++}`
    const startX = (Math.random() - 0.5) * 8
    setBoxes((list) => [...list, { id, boxType, startX }])
  }

  const addTracer = (to: [number, number, number]) => {
    const id = `tracer-${nextId.current++}`
    setTracers((list) => [...list, { id, from: MUZZLE, to }])
    setFlashes((list) => [...list, { id: `flash-${nextId.current++}` }])
    triggerFireSignal()
  }

  const handleMiss = (e: ThreeEvent<PointerEvent>) => {
    if (!tryFire()) return
    const p = e.point
    addTracer([p.x, p.y, p.z])
  }

  return (
    <>
      <CameraRig />
      <fog attach="fog" args={[SEA_FOG.color, SEA_FOG.near, SEA_FOG.far]} />
      <hemisphereLight args={[0xbac4c8, 0x1f3a40, 1.2]} />
      <directionalLight position={SUN_POSITION} intensity={1.6} color={0xffe2c0} castShadow />
      <Spawner onSpawn={spawnMob} />
      <SupplyBoxSpawner onSpawn={spawnBox} />
      <Sea onPointerDown={handleMiss} />
      <Mountains />
      <Breakwater />
      <Turret />
      {waveNumber === 3 && bossTriggered && (
        <Boss
          onHit={(targetWeak) => {
            if (!tryFire()) return
            damageBoss(targetWeak)
          }}
        />
      )}
      {mobs.map((m) => (
        <Mob
          key={m.id}
          kind={m.kind}
          startX={m.startX}
          startZ={m.startZ}
          onHit={(point) => {
            if (!tryFire()) return false
            addTracer(point)
            setMobs((list) => list.filter((x) => x.id !== m.id))
            defeatCrab()
            return true
          }}
          onReachWall={() => {
            setMobs((list) => list.filter((x) => x.id !== m.id))
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
      {flashes.map((f) => (
        <MuzzleFlash
          key={f.id}
          position={MUZZLE}
          onDone={() => setFlashes((list) => list.filter((x) => x.id !== f.id))}
        />
      ))}
    </>
  )
}

export function Scene() {
  return (
    <Canvas camera={{ position: [0, 1.2, 0], fov: 60, far: 3000 }} shadows>
      <SceneContents />
    </Canvas>
  )
}
