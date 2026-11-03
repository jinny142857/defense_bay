import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { Group, Mesh } from 'three'
import type { GLTF } from 'three-stdlib'
import { fireSignal } from './fireSignal'

const MODEL_URL = '/assets/tank.glb'
const MODEL_SCALE = 0.32
const RECOIL_DISTANCE = 0.35
const RECOIL_DECAY = 0.82

type TankGLTF = GLTF & {
  nodes: {
    Turret_Pivot: Group
    Gun_Pivot: Group
    Barrel_Recoil: Group
  }
}

// BlueTank 에셋(사용자 제작, public/assets/tank.glb). Turret_Pivot(요)>Gun_Pivot(고저각)>Barrel_Recoil(발사 반동).
// 모델의 전방은 로컬 +X라서 래퍼를 +90도 돌려 게임 전방(-Z)에 맞춘다.
export function Turret() {
  const { scene, nodes } = useGLTF(MODEL_URL) as unknown as TankGLTF
  const { pointer } = useThree()
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
    if (!turretPivot || !gunPivot || !recoil) return

    if (fireSignal.seq !== lastFireSeqRef.current) {
      lastFireSeqRef.current = fireSignal.seq
      recoilRef.current = 1
    }
    recoilRef.current *= RECOIL_DECAY

    // delta 기반 지수 보간 — 프레임레이트와 무관하게 "둔탁하지 않고" 민첩하게 커서를 따라가도록 한다.
    const smoothing = 1 - Math.exp(-delta * 18)
    const targetYaw = pointer.x * 0.7
    const targetPitch = -pointer.y * 0.35
    turretPivot.rotation.y += (targetYaw - turretPivot.rotation.y) * smoothing
    gunPivot.rotation.z += (targetPitch - gunPivot.rotation.z) * smoothing
    recoil.position.x = -recoilRef.current * RECOIL_DISTANCE
  })

  return (
    <group position={[0, 1.0, -6]} rotation={[0, Math.PI / 2, 0]} scale={MODEL_SCALE}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload(MODEL_URL)
