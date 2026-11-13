import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import type { ThreeEvent } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { Object3D } from 'three'
import { Sea } from './Sea'
import { Mountains } from './Mountains'
import { StageScenery } from './StageScenery'
import { getStageTheme } from '../config/stageThemes'
import { Breakwater } from './Breakwater'
import { Turret } from './Turret'
import { Mob } from './Mob'
import { SupplyBox } from './SupplyBox'
import { Boss, COMBAT_Z as BOSS_COMBAT_Z } from './Boss'
import { BossShell } from './BossShell'
import { Projectile } from './Projectile'
import { MuzzleFlash } from './MuzzleFlash'
import { ImpactEffect } from './ImpactEffect'
import { WaterBurstEffect } from './WaterBurstEffect'
import { DamagePopup } from './DamagePopup'
import { triggerFireSignal } from './fireSignal'
import { sound } from './sound'
import { aimSignal } from './aimSignal'
import { raycastTargets } from './raycastRegistry'
import { balance } from '../config/balance'
import { WEAPON_DEFS } from '../data/weapons'
import { getStageDef } from '../data/stages'
import { useGameStore } from '../state/gameStore'
import type { MobKind, SupplyBoxType } from '../types'

// SeaEnvironment_GameAssets 가이드 좌표계: 원점 = 방파제/플레이어, 바다 쪽 = -Z, 1 unit = 1m
// 가이드 권장치(600~800m)는 몹 모델 실제 크기(1~2m) 대비 너무 멀어서 사실상 안 보였고(안개도 한몫),
// 40~65m는 등장하자마자 바로 코앞이라 다가오는 느낌이 없었다. 안개(near=120) 경계 너머에서 작게
// 희미하게 나타나 점점 또렷해지며 다가오도록 그 사이로 더 뒤로 보낸다(스폰 간격도 같이 늘려서
// 한꺼번에 몰려오지 않게 한다 — balance.combat.crabSpawnIntervalSec 참고).
// Z 스폰 범위를 너무 넓게 뒀더니(180~260) 무작위 거리 차 때문에 연속 스폰된 몹들이 화면에
// 등장하는 타이밍이 뒤섞여 "한꺼번에 여럿 등장"으로 보였다 — 범위를 좁혀서 스폰 간격(3초)이
// 등장 순서를 그대로 지배하게 한다.
// 개체별 속도/스폰 간격에 편차를 둔 뒤로는(Mob.tsx speedJitter, nextSpawnInterval) 굳이 Z 범위를
// 좁게 묶어두지 않아도 "한꺼번에 몰려온다"는 느낌이 안 생긴다 — 위치도 다양하게 보이도록 다시
// 넓힌다.
const MOB_SPAWN_X_SPREAD = 120
const MOB_SPAWN_Z_MIN = 190
const MOB_SPAWN_Z_MAX = 240
const BOX_Z = -16
// SupplyBox가 모델의 실제 바닥(튜브)을 기준으로 이 높이에 맞춰 띄우므로, 이제는 수면 자체의
// 높이(0 부근)만 쓰면 된다 — 살짝 음수로 둬서 튜브가 물에 약간 잠긴 듯 보이게 한다.
const BOX_GROUND_Y = -0.05
const MUZZLE: [number, number, number] = [0, 1.63, -8.3]
const MUZZLE_VEC = new Vector3(...MUZZLE)
const MOB_IMPACT_COLOR = '#ff5a36'
const BOSS_IMPACT_COLOR = '#4ad9c9'
const MOB_HIT_POPUP_COLOR = '#f3e9d2'
const BOX_IMPACT_COLOR = '#ffd36b'
// 발사 쿨다운에 막혀 클릭이 조용히 씹히면 "맞혔는데 아무 일도 안 생긴다"로 보인다 — 쿨다운 때문에
// 거부된 클릭도 눈에 띄는 표시를 띄워서 "조준은 맞았는데 아직 재장전 중"이라는 걸 알려준다.
const RELOAD_POPUP_COLOR = '#9a9a92'
const BOMBARD_IMPACT_COLOR = '#ff8a3d'
const BOSS_CRIT_POPUP_COLOR = '#f2b22e'
const BOSS_NORMAL_POPUP_COLOR = '#c9c9c9'
const BOSS_SHELL_IMPACT_COLOR = '#ff6a2b'
// 보스 포탄이 출발하는 높이(보스 몸통 위쪽 즈음)와, 방파제 쪽 착탄 지점이 흩어질 가로 폭/높이.
const BOSS_SHELL_FROM_Y = 9
// 착탄 지점이 카메라 시야 밖으로 나가면 쏴서 막을 수가 없다 — 카메라(z=-3.3)에서 착탄
// 깊이(z=-6.5)까지는 3.2m뿐이라 화면에 들어오는 가로 폭이 생각보다 좁다(시야각 계산상 약
// ±2.4m). 넉넉히 안쪽으로 좁혀서 항상 화면 안에 떨어지게 한다.
const BOSS_SHELL_TARGET_X_SPREAD = 4
const BOSS_SHELL_TARGET_Y = 1.3
const BOSS_SHELL_TARGET_Z = -6.5
// 위에서 내려다보는 각도는 유지하고, 카메라를 탱크 쪽으로 더 앞으로 당긴다.
const CAMERA_HOME = new Vector3(0, 2.6, -3.3)
const CAMERA_HOME_LOOK: [number, number, number] = [0, 2.5, -20]
// 보스 등장 연출: 바다 한가운데 고정된 거신 둘레를 카메라가 한 바퀴 돈다.
const BOSS_ORBIT_RADIUS = 18
const BOSS_ORBIT_HEIGHT = 5
const BOSS_LOOK_HEIGHT = 3

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
  scale?: number
}

interface WaterBurst {
  id: string
  position: [number, number, number]
}

interface ShellEntity {
  id: string
  from: [number, number, number]
  to: [number, number, number]
}

interface Popup {
  id: string
  position: [number, number, number]
  text: string
  color: string
}

// 스폰 간격에 ±40% 정도 무작위 편차를 줘서 똑같은 박자로 한 줄씩 나오지 않게 한다
// ("몹들이 너무 동시에 다가온다" 피드백 — 고정 간격이면 속도가 비슷한 몹들이 계속 같은
// 간격으로 붙어서 결국 한 덩어리처럼 보인다).
function nextSpawnInterval() {
  return balance.combat.crabSpawnIntervalSec * (0.6 + Math.random() * 0.8)
}

function Spawner({ onSpawn }: { onSpawn: (progress: number) => void }) {
  // 웨이브 시작과 동시에 첫 몹이 바로 등장하도록 타이머를 스폰 간격만큼 미리 채워 둔다
  // ("시작하면 바로 나와야" 피드백 — 첫 스폰까지 기다리는 공백을 없앤다).
  const timer = useRef<number>(balance.combat.crabSpawnIntervalSec)
  const nextInterval = useRef<number>(balance.combat.crabSpawnIntervalSec)
  const spawnedCount = useRef(0)
  const crabsTotal = useGameStore((s) => s.crabsTotal)
  const phase = useGameStore((s) => s.phase)

  useFrame((_, delta) => {
    if (phase !== 'COMBAT' || spawnedCount.current >= crabsTotal) return
    timer.current += delta
    if (timer.current >= nextInterval.current) {
      timer.current = 0
      nextInterval.current = nextSpawnInterval()
      // 웨이브 안에서 몇 번째 스폰인지(0~1) — 초반엔 게부터, 뒤로 갈수록 두꺼비가 섞이게 한다.
      onSpawn(spawnedCount.current / crabsTotal)
      spawnedCount.current += 1
    }
  })

  return null
}

function SupplyBoxSpawner({
  onSpawn,
  hasActiveBox,
  bossActive,
}: {
  onSpawn: (type: SupplyBoxType) => void
  // 보급상자는 한 번에 하나만 떠 있어야 하므로, 앞선 상자가 잡히거나 사라지기 전까지는 다음
  // 상자를 띄우지 않는다(타이머는 그동안 멈춰 있다가 자리가 비면 이어서 센다).
  hasActiveBox: boolean
  // 보스가 다가와 교전이 시작되면(웨이브 3) 이 웨이브의 할당량(targetCount)을 이미 다 써버린
  // 경우가 많다 — 긴 보스전 내내 보급상자가 한 번도 안 뜨는 문제가 있었다. 보스전 중에는
  // 할당량 제한 없이 같은 타이머로 계속 뜨게 한다.
  bossActive: boolean
}) {
  const phase = useGameStore((s) => s.phase)
  const targetCount = useRef(
    balance.supplyBox.spawnMinPerWave +
      Math.floor(Math.random() * (balance.supplyBox.spawnMaxPerWave - balance.supplyBox.spawnMinPerWave + 1)),
  )
  const spawnedCount = useRef(0)
  const timer = useRef(Math.random() * 4 + 3)

  useFrame((_, delta) => {
    if (phase !== 'COMBAT' || hasActiveBox) return
    if (!bossActive && spawnedCount.current >= targetCount.current) return
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
// scene.children 전체(산/방파제/탱크 등 폴리곤 많은 배경 포함)를 매 프레임 훑으면 몹이 늘어날수록
// 눈에 띄게 느려져서, 실제 조준 대상만 raycastRegistry에 등록해두고 그것만 레이캐스트한다.
function AimRay() {
  useFrame(({ pointer, camera, raycaster }) => {
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects([...raycastTargets], true)
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
  const [waterBursts, setWaterBursts] = useState<WaterBurst[]>([])
  const [popups, setPopups] = useState<Popup[]>([])
  const [shells, setShells] = useState<ShellEntity[]>([])
  const defeatCrab = useGameStore((s) => s.defeatCrab)
  const crabReachedBreakwater = useGameStore((s) => s.crabReachedBreakwater)
  const openSupplyBox = useGameStore((s) => s.openSupplyBox)
  const damageBoss = useGameStore((s) => s.damageBoss)
  const waveNumber = useGameStore((s) => s.waveNumber)
  const currentStageId = useGameStore((s) => s.currentStageId)
  const isBossWave = waveNumber === getStageDef(currentStageId).crabCountsByWave.length
  const theme = getStageTheme(currentStageId)
  const sunPosition = useMemo(
    () => new Vector3(...theme.sun.dir).normalize().multiplyScalar(500),
    [theme],
  )
  const { gl } = useThree()
  useEffect(() => {
    gl.toneMappingExposure = theme.exposure
  }, [gl, theme])
  const bossActive = useGameStore((s) => s.bossActive)
  const bombardPulse = useGameStore((s) => s.supplyBombardPulse)
  const bossShellPulse = useGameStore((s) => s.bossShellPulse)
  const interceptBossShell = useGameStore((s) => s.interceptBossShell)
  const resolveBossAttack = useGameStore((s) => s.resolveBossAttack)
  const fireRateBuffPct = useGameStore((s) => s.fireRateBuffPct)
  const equippedWeaponId = useGameStore((s) => s.equippedWeaponId)
  const infiniteReloadUntil = useGameStore((s) => s.infiniteReloadUntil)
  const nextId = useRef(0)
  const lastShotAtRef = useRef(0)

  useEffect(() => {
    if (bombardPulse === 0) return
    const count = mobs.length
    if (count === 0) return
    sound.playAirstrike()
    // 공중 포격 연출: 몹들이 흩어져 있던 전장 위로 폭발이 차례로 터지는 "융단폭격" 느낌을 준다.
    // 몹의 현재 좌표는 추적하지 않으므로(각자 내부에서 움직임), 스폰 가능 영역 안에서 무작위로
    // 흩뿌려 대략적인 전장 범위를 훑는 걸로 대신한다.
    const strikeCount = Math.min(10, Math.max(4, count))
    for (let i = 0; i < strikeCount; i++) {
      const sx = (Math.random() - 0.5) * MOB_SPAWN_X_SPREAD
      const sz = -(10 + Math.random() * 90)
      setTimeout(() => addWaterBurst([sx, 0, sz]), i * 90)
    }
    setMobs([])
    for (let i = 0; i < count; i++) defeatCrab()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bombardPulse])

  // 보스의 "파도 공격" 전조가 끝나면(Boss.tsx launchBossShell) 실제로 포탄 하나를 띄운다 —
  // 보스 쪽에서 출발해 방파제 쪽 무작위 지점으로 떨어지는 포물선을 그린다.
  useEffect(() => {
    if (bossShellPulse === 0) return
    const id = `shell-${nextId.current++}`
    const from: [number, number, number] = [0, BOSS_SHELL_FROM_Y, BOSS_COMBAT_Z]
    const to: [number, number, number] = [
      (Math.random() - 0.5) * BOSS_SHELL_TARGET_X_SPREAD,
      BOSS_SHELL_TARGET_Y,
      BOSS_SHELL_TARGET_Z,
    ]
    setShells((list) => [...list, { id, from, to }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bossShellPulse])

  const tryFire = (): boolean => {
    const now = Date.now()
    if (now < infiniteReloadUntil) {
      lastShotAtRef.current = now
      return true
    }
    const weapon = WEAPON_DEFS[equippedWeaponId]
    // fireRateBuffPct도 attackBuffPct와 같은 이유(웨이브 넘길 때 리셋 안 되고 누적)로 하한을 둔다 —
    // 안 그러면 쿨다운이 몇 초까지 늘어나 "쏴도 반응이 없다"처럼 보일 수 있다.
    const fireRate = weapon.baseFireRate * Math.max(0.5, 1 + fireRateBuffPct)
    const intervalMs = 1000 / fireRate
    if (now - lastShotAtRef.current < intervalMs) return false
    lastShotAtRef.current = now
    return true
  }

  const spawnMob = (progress: number) => {
    const id = `mob-${nextId.current++}`
    const startX = (Math.random() - 0.5) * MOB_SPAWN_X_SPREAD
    const startZ = -(MOB_SPAWN_Z_MIN + Math.random() * (MOB_SPAWN_Z_MAX - MOB_SPAWN_Z_MIN))
    // 초반 35%는 전부 게, 그 뒤로는 두꺼비 비중이 점점 늘어난다("게가 먼저 오고 두꺼비가 뒤에
    // 섞이면 좋겠다"는 피드백 — 완전 무작위 50/50이면 두꺼비가 바로 처음부터 튀어나올 수 있었다).
    const frogChance = progress < 0.35 ? 0 : (progress - 0.35) / 0.65
    const kind: MobKind = Math.random() < frogChance ? 'frogTurtle' : 'crab'
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
    sound.playCannonFire()
  }

  const addImpact = (position: [number, number, number], color: string, scale = 1) => {
    const id = `impact-${nextId.current++}`
    // 명중 지점은 피격 대상 표면 위라서, 그 자리에 그대로 띄우면 섬광/파편이 모델 지오메트리에
    // 가려 거의 안 보인다(addPopup과 동일 문제). 카메라 쪽으로 살짝 띄워서 확실히 보이게 한다.
    const offsetPosition: [number, number, number] = [position[0], position[1], position[2] + 1.0]
    setImpacts((list) => [...list, { id, position: offsetPosition, color, scale }])
    sound.playExplosion()
  }

  // 공중 포격 착탄: 수면 물기둥 + 그 밑동에 작은 화염(VFX_SPEC.md 권장 0.55배)을 같이 띄운다.
  const addWaterBurst = (position: [number, number, number]) => {
    const id = `waterburst-${nextId.current++}`
    setWaterBursts((list) => [...list, { id, position }])
    addImpact(position, BOMBARD_IMPACT_COLOR, 0.55)
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
      <fog attach="fog" args={[theme.fog.color, theme.fog.near, theme.fog.far]} />
      <hemisphereLight args={[theme.hemi.sky, theme.hemi.ground, theme.hemi.intensity]} />
      <directionalLight position={sunPosition} intensity={theme.sun.intensity} color={theme.sun.color} castShadow />
      <Spawner onSpawn={spawnMob} />
      <SupplyBoxSpawner onSpawn={spawnBox} hasActiveBox={boxes.length > 0} bossActive={bossActive} />
      <Sea theme={theme} onPointerDown={handleMiss} />
      {theme.sceneryUrl ? <StageScenery modelUrl={theme.sceneryUrl} waveAmp={theme.sea.waveAmp} /> : <Mountains />}
      <Breakwater />
      <Turret />
      {isBossWave && (
        <Boss
          asset={getStageDef(currentStageId).bossAsset}
          onHit={(targetWeak, point) => {
            if (!tryFire()) {
              addPopup(point, '재장전 중', RELOAD_POPUP_COLOR)
              return
            }
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
      {shells.map((sh) => (
        <BossShell
          key={sh.id}
          from={sh.from}
          to={sh.to}
          onHit={(point) => {
            if (!tryFire()) {
              addPopup(point, '재장전 중', RELOAD_POPUP_COLOR)
              return false
            }
            addTracer(point)
            addImpact(point, BOSS_SHELL_IMPACT_COLOR)
            interceptBossShell()
            setShells((list) => list.filter((x) => x.id !== sh.id))
            return true
          }}
          onLand={(point) => {
            addImpact(point, BOSS_SHELL_IMPACT_COLOR)
            resolveBossAttack()
            setShells((list) => list.filter((x) => x.id !== sh.id))
          }}
        />
      ))}
      {mobs.map((m) => (
        <Mob
          key={m.id}
          kind={m.kind}
          startX={m.startX}
          startZ={m.startZ}
          onHit={(point) => {
            if (!tryFire()) {
              addPopup(point, '재장전 중', RELOAD_POPUP_COLOR)
              return false
            }
            addTracer(point)
            return true
          }}
          onDamaged={(point, damage) => {
            addImpact(point, MOB_IMPACT_COLOR)
            addPopup(point, Math.round(damage).toString(), MOB_HIT_POPUP_COLOR)
          }}
          onKilled={(atWall) => {
            setMobs((list) => list.filter((x) => x.id !== m.id))
            // 방파제에서 마무리 처치된 경우 내구도/남은 괴수는 onReachWall 때 이미 반영됐으므로
            // 여기서 defeatCrab()을 또 부르면 이중 집계가 된다 — 조용히 치우기만 한다.
            if (!atWall) defeatCrab()
          }}
          onReachWall={() => {
            // 통계(내구도/남은 괴수)만 바로 반영 — 몹은 방파제에 들러붙어 "공격"하며 남아있다가
            // 플레이어가 잡거나(onKilled) 시간이 지나 onExpire로 조용히 정리된다.
            crabReachedBreakwater()
          }}
          onExpire={() => {
            setMobs((list) => list.filter((x) => x.id !== m.id))
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
          onCatch={(point) => {
            if (!tryFire()) {
              addPopup(point, '재장전 중', RELOAD_POPUP_COLOR)
              return false
            }
            addTracer(point)
            // 문제를 실제로 띄울 수 있을 때만 상자를 치운다 — 실패하면(드물게 이미 다른 문제가
            // 떠 있는 경우 등) 상자가 그대로 남아 다시 시도할 수 있다("맞혔는데 문제가 안 뜨고
            // 상자만 사라지는" 버그 방지).
            if (!openSupplyBox(b.boxType)) return false
            addImpact(point, BOX_IMPACT_COLOR)
            setBoxes((list) => list.filter((x) => x.id !== b.id))
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
          scale={im.scale}
          onDone={() => setImpacts((list) => list.filter((x) => x.id !== im.id))}
        />
      ))}
      {waterBursts.map((wb) => (
        <WaterBurstEffect
          key={wb.id}
          position={wb.position}
          onDone={() => setWaterBursts((list) => list.filter((x) => x.id !== wb.id))}
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
      {/* 해파리 대왕 스테이지 — 산호/해파리 무리/보스의 발광 재질이 Bloom으로 번져 보이게 한다. */}
      {theme.bloom && (
        <EffectComposer>
          <Bloom luminanceThreshold={0.8} mipmapBlur />
        </EffectComposer>
      )}
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
