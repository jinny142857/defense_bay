import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Vector3 } from 'three'
import type { Group, Mesh } from 'three'
import type { GLTF } from 'three-stdlib'
import { fireSignal } from './fireSignal'
import { aimSignal } from './aimSignal'
import { muzzleSignal } from './muzzleSignal'
import { useGameStore } from '../state/gameStore'
import { getVehicleRender } from '../data/vehicles'

const RECOIL_DECAY = 0.82
const MAX_PITCH = 0.6
// 매 프레임 목표각으로 순간 이동(각도 보간 없음)시켰더니 레이캐스트/프레임 타이밍이 조금만
// 흔들려도 포신이 "뚝뚝 끊기듯" 튀어 보였다. 완전히 순간이동하는 대신 아주 빠르게(약 1/10초 안에)
// 수렴하는 지수 감쇠로 목표각을 뒤쫓게 하면, 체감상 즉각 반응하면서도 움직임 자체는 매끄럽다.
const TURRET_RESPONSE = 24
// 포구 화염/연기 메시(모델에 내장) 스케일 펄스 — 0에서 솟았다가 바로 줄어든다(TankMkII 가이드).
const MUZZLE_PULSE_SEC = 0.15
const MUZZLE_FLASH_PEAK_SCALE = 1.7
const MUZZLE_SMOKE_PEAK_SCALE = 1.2

type TankGLTF = GLTF & {
  nodes: {
    Turret_Pivot: Group
    Gun_Pivot: Group
    Barrel_Recoil: Group
    Muzzle_Point?: Group
    Muzzle_Flash?: Mesh
    Muzzle_Smoke?: Mesh
  }
}

const worldAimPoint = new Vector3()
const localAimPoint = new Vector3()
const muzzleWorldPos = new Vector3()

// 최단 경로로 각도를 보간(-PI/PI 경계를 넘나들 때 먼 길로 도는 것을 방지).
function lerpAngle(from: number, to: number, t: number): number {
  let diff = (to - from) % (Math.PI * 2)
  if (diff > Math.PI) diff -= Math.PI * 2
  else if (diff < -Math.PI) diff += Math.PI * 2
  return from + diff * t
}

// 플레이어 전차 — 어떤 모델을 쓸지는 장착한 기체(data/vehicles.ts의 render 정보)가 정한다.
// 모든 전차가 Turret_Pivot(요)>Gun_Pivot(고저각)>Barrel_Recoil(발사 반동)>Muzzle_Point(포구)
// 계층을 공유한다는 전제로, 모델만 갈아 끼우면 조준/반동 로직은 그대로 재사용된다.
export function Turret() {
  const equippedVehicleId = useGameStore((s) => s.equippedVehicleId)
  const asset = getVehicleRender(equippedVehicleId)
  const { scene, nodes } = useGLTF(asset.modelUrl) as unknown as TankGLTF
  const wrapperRef = useRef<Group>(null)
  const recoilRef = useRef(0)
  const muzzlePulseRef = useRef(0)
  const lastFireSeqRef = useRef(fireSignal.seq)

  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as Mesh).isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })
  }, [scene])

  // 전차를 바꿔 끼우면 포구 화염/연기가 숨은 상태(scale 0)로 돌아가 있어야 한다.
  useEffect(() => {
    muzzlePulseRef.current = 0
    nodes.Muzzle_Flash?.scale.setScalar(0.001)
    nodes.Muzzle_Smoke?.scale.setScalar(0.001)
  }, [nodes])

  useFrame((_, delta) => {
    const turretPivot = nodes.Turret_Pivot
    const gunPivot = nodes.Gun_Pivot
    const recoil = nodes.Barrel_Recoil
    const wrapper = wrapperRef.current
    if (!turretPivot || !gunPivot || !recoil || !wrapper) return

    if (fireSignal.seq !== lastFireSeqRef.current) {
      lastFireSeqRef.current = fireSignal.seq
      recoilRef.current = 1
      muzzlePulseRef.current = MUZZLE_PULSE_SEC
    }
    recoilRef.current *= RECOIL_DECAY

    // 크로스헤어(aimSignal)가 가리키는 실제 3D 지점을 포신이 겨냥한다. 목표각 자체는 atan2로
    // 매 프레임 바로 구하되(부호 오류 여지 없음), 실제로 그 각도로 "도달"하는 건 지수 감쇠로
    // 아주 빠르게 수렴시켜 — 즉각 반응하는 속도감은 유지하면서 프레임 간 흔들림 없이 매끄럽게 돈다.
    if (aimSignal.visible) {
      worldAimPoint.set(aimSignal.worldX, aimSignal.worldY, aimSignal.worldZ)
      wrapper.worldToLocal(localAimPoint.copy(worldAimPoint))
      const ddx = localAimPoint.x - turretPivot.position.x
      const ddz = localAimPoint.z - turretPivot.position.z
      const horizontalDist = Math.hypot(ddx, ddz)
      const ddy = localAimPoint.y - turretPivot.position.y
      const yawTarget = Math.atan2(-ddz, ddx)
      const pitchTarget = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, Math.atan2(ddy, horizontalDist)))
      const t = 1 - Math.exp(-TURRET_RESPONSE * delta)
      turretPivot.rotation.y = lerpAngle(turretPivot.rotation.y, yawTarget, t)
      gunPivot.rotation.z += (pitchTarget - gunPivot.rotation.z) * t
    }

    recoil.position.x = -recoilRef.current * asset.recoilDistance

    // 포구 화염/연기: 발사 순간 스케일이 0 -> 피크 -> 0으로 아주 짧게 솟았다 사라진다.
    if (muzzlePulseRef.current > 0) {
      muzzlePulseRef.current = Math.max(0, muzzlePulseRef.current - delta)
      const t = muzzlePulseRef.current / MUZZLE_PULSE_SEC // 1 -> 0
      const pulse = Math.sin((1 - t) * Math.PI) // 0 -> 1 -> 0
      nodes.Muzzle_Flash?.scale.setScalar(Math.max(0.001, pulse * MUZZLE_FLASH_PEAK_SCALE))
      nodes.Muzzle_Smoke?.scale.setScalar(Math.max(0.001, pulse * MUZZLE_SMOKE_PEAK_SCALE))
    }

    // 포구(Muzzle_Point) 월드 좌표를 신호에 반영 — Scene.tsx가 예광탄/포구 이펙트 시작점으로 쓴다.
    // 장착 기체마다 포신 길이가 달라서 더 이상 고정 좌표를 쓸 수 없다.
    const muzzlePoint = nodes.Muzzle_Point
    if (muzzlePoint) {
      muzzlePoint.getWorldPosition(muzzleWorldPos)
      muzzleSignal.x = muzzleWorldPos.x
      muzzleSignal.y = muzzleWorldPos.y
      muzzleSignal.z = muzzleWorldPos.z
    }
  })

  return (
    <group
      ref={wrapperRef}
      position={[0, 1.0, -6]}
      rotation={[0, asset.wrapperRotationY, 0]}
      scale={asset.scale}
    >
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload('/assets/tank.glb')
useGLTF.preload('/assets/tank-mk2.glb')
