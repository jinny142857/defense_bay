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

type TankGLTF = GLTF & {
  nodes: {
    Turret_Pivot: Group
    Gun_Pivot: Group
    Barrel_Recoil: Group
  }
}

const worldAimPoint = new Vector3()
const localAimPoint = new Vector3()

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

  useFrame(() => {
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

    // 크로스헤어(aimSignal)가 가리키는 실제 3D 지점을 포신이 "즉시" 겨냥한다 — 속도감을 위해
    // 보간 없이 매 프레임 바로 맞춘다. 래퍼 로컬 좌표계로 변환한 뒤(모델 설계상 전방은 +X),
    // 그 프레임에서 atan2로 요(yaw)/고저각(pitch)을 직접 구해 부호 오류 여지를 없앤다.
    if (aimSignal.visible) {
      worldAimPoint.set(aimSignal.worldX, aimSignal.worldY, aimSignal.worldZ)
      wrapper.worldToLocal(localAimPoint.copy(worldAimPoint))
      const ddx = localAimPoint.x - turretPivot.position.x
      const ddz = localAimPoint.z - turretPivot.position.z
      const horizontalDist = Math.hypot(ddx, ddz)
      const ddy = localAimPoint.y - turretPivot.position.y
      turretPivot.rotation.y = Math.atan2(-ddz, ddx)
      gunPivot.rotation.z = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, Math.atan2(ddy, horizontalDist)))
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
