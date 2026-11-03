import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { Object3D } from 'three'
import { Sea } from './Sea'
import { Mountains } from './Mountains'
import { SEA_FOG, SUN_DIRECTION } from './SeaWater.js'
import { Breakwater } from './Breakwater'
import { Turret } from './Turret'
import { Mob } from './Mob'
import { SupplyBox } from './SupplyBox'
import { Boss, COMBAT_Z as BOSS_COMBAT_Z } from './Boss'
import { Projectile } from './Projectile'
import { MuzzleFlash } from './MuzzleFlash'
import { ImpactEffect } from './ImpactEffect'
import { triggerFireSignal } from './fireSignal'
import { aimSignal } from './aimSignal'
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
const MUZZLE_VEC = new Vector3(...MUZZLE)
const MOB_IMPACT_COLOR = '#ff5a36'
const BOSS_IMPACT_COLOR = '#4ad9c9'
// 위에서 내려다보는 각도는 유지하고, 카메라를 탱크 쪽으로 더 앞으로 당긴다.
const CAMERA_HOME = new Vector3(0, 2.6, -3.3)
const CAMERA_HOME_LOOK: [number, number, number] = [0, 2.5, -20]
// 보스 등장 연출: 바다 한가운데 고정된 거신 둘레를 카메라가 한 바퀴 돈다.
const BOSS_ORBIT_RADIUS = 18
const BOSS_ORBIT_HEIGHT = 5
const BOSS_LOOK_HEIGHT = 3
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

interface Impact {
  id: string
  position: [number, number, number]
  color: string
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

const orbitTarget = new Vector3()

function CameraRig() {
  const { camera } = useThree()
  const phase = useGameStore((s) => s.phase)
  const introStartRef = useRef<number | null>(null)

  useEffect(() => {
    camera.position.copy(CAMERA_HOME)
    camera.lookAt(...CAMERA_HOME_LOOK)
  }, [camera])

  useEffect(() => {
    if (phase === 'BOSS_INTRO') introStartRef.current = performance.now()
  }, [phase])

  useFrame(() => {
    if (phase === 'BOSS_INTRO') {
      const elapsed = introStartRef.current != null ? (performance.now() - introStartRef.current) / 1000 : 0
      const angle = (elapsed / balance.boss.introDurationSec) * Math.PI * 2
      orbitTarget.set(
        Math.sin(angle) * BOSS_ORBIT_RADIUS,
        BOSS_ORBIT_HEIGHT,
        BOSS_COMBAT_Z + Math.cos(angle) * BOSS_ORBIT_RADIUS,
      )
      camera.position.lerp(orbitTarget, 0.08)
      camera.lookAt(0, BOSS_LOOK_HEIGHT, BOSS_COMBAT_Z)
    } else {
      camera.position.lerp(CAMERA_HOME, 0.05)
      camera.lookAt(...CAMERA_HOME_LOOK)
    }
  })

  return null
}

const aimHitPoint = new Vector3()

// 매 프레임 포인터 위치로 레이캐스트해 "지금 쏘면 맞는지"를 판정, 2D HUD 크로스헤어(aimSignal)에
// 공유한다. 명중 대상(몹/보급상자/보스)은 userData.hittable=true로 표시해 올라가며 판별한다.
function AimRay() {
  useFrame(({ pointer, camera, raycaster, scene }) => {
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(scene.children, true)
    if (hits.length === 0) {
      aimSignal.visible = false
      return
    }
    const first = hits[0]
    let obj: Object3D | null = first.object
    let hittable = false
    while (obj) {
      if (obj.userData?.hittable) {
        hittable = true
        break
      }
      obj = obj.parent
    }
    aimHitPoint.copy(first.point)
    aimSignal.visible = true
    aimSignal.hit = hittable
    aimSignal.screenX = (pointer.x + 1) / 2
    aimSignal.screenY = (1 - pointer.y) / 2
    aimSignal.distanceM = MUZZLE_VEC.distanceTo(aimHitPoint)
  })
  return null
}

function SceneContents() {
  const [mobs, setMobs] = useState<MobEntity[]>([])
  const [boxes, setBoxes] = useState<BoxEntity[]>([])
  const [tracers, setTracers] = useState<Tracer[]>([])
  const [flashes, setFlashes] = useState<{ id: string }[]>([])
  const [impacts, setImpacts] = useState<Impact[]>([])
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

  const addImpact = (position: [number, number, number], color: string) => {
    const id = `impact-${nextId.current++}`
    setImpacts((list) => [...list, { id, position, color }])
  }

  const handleMiss = (e: ThreeEvent<PointerEvent>) => {
    if (!tryFire()) return
    const p = e.point
    addTracer([p.x, p.y, p.z])
  }

  return (
    <>
      <CameraRig />
      <AimRay />
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
          onHit={(targetWeak, point) => {
            if (!tryFire()) return
            addTracer(point)
            addImpact(point, BOSS_IMPACT_COLOR)
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
            addImpact(point, MOB_IMPACT_COLOR)
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
      {impacts.map((im) => (
        <ImpactEffect
          key={im.id}
          position={im.position}
          color={im.color}
          onDone={() => setImpacts((list) => list.filter((x) => x.id !== im.id))}
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
