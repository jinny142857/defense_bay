import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Vector3 } from 'three'
import type { Group, Mesh } from 'three'
import type { GLTF } from 'three-stdlib'
import { fireSignal } from './fireSignal'
import { aimSignal } from './aimSignal'

const MODEL_URL = '/assets/tank.glb'
const MODEL_SCALE = 0.32
const RECOIL_DISTANCE = 0.35
const RECOIL_DECAY = 0.82
const MAX_PITCH = 0.6
// 매 프레임 목표각으로 순간 이동(각도 보간 없음)시켰더니 레이캐스트/프레임 타이밍이 조금만
// 흔들려도 포신이 "뚝뚝 끊기듯" 튀어 보였다. 완전히 순간이동하는 대신 아주 빠르게(약 1/10초 안에)
// 수렴하는 지수 감쇠로 목표각을 뒤쫓게 하면, 체감상 즉각 반응하면서도 움직임 자체는 매끄럽다.
const TURRET_RESPONSE = 24

type TankGLTF = GLTF & {
  nodes: {
    Turret_Pivot: Group
    Gun_Pivot: Group
    Barrel_Recoil: Group
  }
}

const worldAimPoint = new Vector3()
const localAimPoint = new Vector3()

// 최단 경로로 각도를 보간(-PI/PI 경계를 넘나들 때 먼 길로 도는 것을 방지).
function lerpAngle(from: number, to: number, t: number): number {
  let diff = (to - from) % (Math.PI * 2)
  if (diff > Math.PI) diff -= Math.PI * 2
  else if (diff < -Math.PI) diff += Math.PI * 2
  return from + diff * t
}

// BlueTank 에셋(사용자 제작, public/assets/tank.glb). Turret_Pivot(요)>Gun_Pivot(고저각)>Barrel_Recoil(발사 반동).
// 모델의 전방은 로컬 +X라서 래퍼를 +90도 돌려 게임 전방(-Z)에 맞춘다.
export function Turret() {
  const { scene, nodes } = useGLTF(MODEL_URL) as unknown as TankGLTF
  const wrapperRef = useRef<Group>(null)
  const recoilRef = useRef(0)
  const lastFireSeqRef = useRef(fireSignal.seq)

  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as Mesh).isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })
  }, [scene])

  useFrame((_, delta) => {
    const turretPivot = nodes.Turret_Pivot
    const gunPivot = nodes.Gun_Pivot
    const recoil = nodes.Barrel_Recoil
    const wrapper = wrapperRef.current
    if (!turretPivot || !gunPivot || !recoil || !wrapper) return

    if (fireSignal.seq !== lastFireSeqRef.current) {
      lastFireSeqRef.current = fireSignal.seq
      recoilRef.current = 1
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

    recoil.position.x = -recoilRef.current * RECOIL_DISTANCE
  })

  return (
    <group ref={wrapperRef} position={[0, 1.0, -6]} rotation={[0, Math.PI / 2, 0]} scale={MODEL_SCALE}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload(MODEL_URL)
