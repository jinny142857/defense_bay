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
import { DamagePopup } from './DamagePopup'
import { triggerFireSignal } from './fireSignal'
import { aimSignal } from './aimSignal'
import { balance } from '../config/balance'
import { WEAPON_DEFS } from '../data/weapons'
import { useGameStore } from '../state/gameStore'
import type { MobKind, SupplyBoxType } from '../types'

// SeaEnvironment_GameAssets 가이드 좌표계: 원점 = 방파제/플레이어, 바다 쪽 = -Z, 1 unit = 1m
// 가이드 권장치(600~800m)로 스폰하면 몹 모델이 실제 크기(1~2m) 대비 너무 멀어서 사실상 안 보이고
// 안개(SEA_FOG.far=950, near=120)에도 거의 다 묻힌다. 등장하자마자 형체가 또렷이 보이도록
// 안개 경계(near=120)보다 한참 안쪽에서 스폰한다.
const MOB_SPAWN_X_SPREAD = 30
const MOB_SPAWN_Z_MIN = 40
const MOB_SPAWN_Z_MAX = 65
const BOX_Z = -16
const BOX_GROUND_Y = -0.5
const MUZZLE: [number, number, number] = [0, 1.63, -8.3]
const MUZZLE_VEC = new Vector3(...MUZZLE)
const MOB_IMPACT_COLOR = '#ff5a36'
const BOSS_IMPACT_COLOR = '#4ad9c9'
const MOB_SCORE_POPUP_COLOR = '#4fd1a1'
const BOSS_CRIT_POPUP_COLOR = '#f2b22e'
const BOSS_NORMAL_POPUP_COLOR = '#c9c9c9'
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

interface Popup {
  id: string
  position: [number, number, number]
  text: string
  color: string
}

function Spawner({ onSpawn }: { onSpawn: () => void }) {
  // 웨이브 시작과 동시에 첫 몹이 바로 등장하도록 타이머를 스폰 간격만큼 미리 채워 둔다
  // ("시작하면 바로 나와야" 피드백 — 첫 스폰까지 기다리는 공백을 없앤다).
  const timer = useRef<number>(balance.combat.crabSpawnIntervalSec)
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
    aimSignal.worldX = aimHitPoint.x
    aimSignal.worldY = aimHitPoint.y
    aimSignal.worldZ = aimHitPoint.z
  })
  return null
}

function SceneContents() {
  const [mobs, setMobs] = useState<MobEntity[]>([])
  const [boxes, setBoxes] = useState<BoxEntity[]>([])
  const [tracers, setTracers] = useState<Tracer[]>([])
  const [flashes, setFlashes] = useState<{ id: string }[]>([])
  const [impacts, setImpacts] = useState<Impact[]>([])
  const [popups, setPopups] = useState<Popup[]>([])
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

  const addPopup = (position: [number, number, number], text: string, color: string) => {
    const id = `popup-${nextId.current++}`
    // 명중 지점은 피격 대상 표면 위라서, 그 자리에 그대로 띄우면 모델 자체 지오메트리에 가려
    // 안 보이는 경우가 있다. 위쪽 + 카메라 쪽으로 살짝 띄워서 확실히 보이게 한다.
    const offsetPosition: [number, number, number] = [position[0], position[1] + 0.9, position[2] + 1.0]
    setPopups((list) => [...list, { id, position: offsetPosition, text, color }])
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
            const result = damageBoss(targetWeak)
            if (result) {
              addPopup(
                point,
                Math.round(result.damage).toString(),
                result.critical ? BOSS_CRIT_POPUP_COLOR : BOSS_NORMAL_POPUP_COLOR,
              )
            }
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
            addPopup(point, `+${balance.score.crabDefeated}`, MOB_SCORE_POPUP_COLOR)
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
      {popups.map((p) => (
        <DamagePopup
          key={p.id}
          position={p.position}
          text={p.text}
          color={p.color}
          onDone={() => setPopups((list) => list.filter((x) => x.id !== p.id))}
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
