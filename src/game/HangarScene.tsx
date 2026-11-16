import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { PerspectiveCamera, useAnimations, useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { LoopOnce, Quaternion, Vector3 } from 'three'
import type { Group, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera as ThreePerspectiveCamera } from 'three'
import { useGameStore } from '../state/gameStore'
import { getVehicleRender } from '../data/vehicles'

const HANGAR_MODEL_URL = '/assets/hangar-interior.glb'
const SPIN_SPEED = 0.25 // rad/s (Hangar_README.md)
// 전차 glb에 담긴 발사 연출 클립(조준→반동→포구화염→연기, 약 3.6초)을 전시용으로 반복 재생한다
// (TankMkII 적용 프롬프트의 "무기고 미리보기에서 발사 애니메이션 클립을 전시용으로 재생해줘"
// 지시가 실제로는 구현되지 않고 수동 회전만 있었다는 피드백으로 뒤늦게 추가).
const SHOWCASE_CYCLE_SEC = 5.5
const FALLBACK_CAM = { position: new Vector3(11, 5.4, 18.5), fov: 37.3, near: 0.1, far: 1500 }
const FALLBACK_SPOT_POS = new Vector3(0, 0.29, 0)
// VehicleDisplaySpot 회전(Y축 약 -115°) — glb에서 못 읽었을 때만 쓰는 대체값.
const FALLBACK_SPOT_QUAT = new Quaternion(0, -0.843391478061676, 0, 0.5372995734214783)

// 배경(Hangar_Interior.glb)에 심어둔 HangarCam/VehicleDisplaySpot의 월드 위치·회전을 그대로
// 읽어서 쓴다 — Hangar_README.md 수치를 하드코딩하지 않는 이유는, 만든 쪽에서 구도를 다시
// 조정해 다시 넘겨줘도 코드를 고칠 필요가 없게 하기 위해서다.
function useHangarRefPoints(scene: Object3D) {
  return useMemo(() => {
    scene.updateMatrixWorld(true)
    const camNode = scene.getObjectByName('HangarCam') as ThreePerspectiveCamera | undefined
    const spotNode = scene.getObjectByName('VehicleDisplaySpot')

    const camPosition = FALLBACK_CAM.position.clone()
    let fov = FALLBACK_CAM.fov
    let near = FALLBACK_CAM.near
    let far = FALLBACK_CAM.far
    const camQuaternion = new Quaternion()
    if (camNode) {
      camNode.getWorldPosition(camPosition)
      camNode.getWorldQuaternion(camQuaternion)
      fov = camNode.fov
      near = camNode.near
      far = camNode.far
    }

    const spotPosition = FALLBACK_SPOT_POS.clone()
    const spotQuaternion = FALLBACK_SPOT_QUAT.clone()
    if (spotNode) {
      spotNode.getWorldPosition(spotPosition)
      spotNode.getWorldQuaternion(spotQuaternion)
    }

    return { camPosition, camQuaternion, fov, near, far, spotPosition, spotQuaternion }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])
}

function HangarBackground() {
  const { scene } = useGLTF(HANGAR_MODEL_URL)
  const model = useMemo(() => scene.clone(true), [scene])

  useEffect(() => {
    model.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      const mat = mesh.material as MeshStandardMaterial
      mat.fog = false
      mat.flatShading = true
      mat.needsUpdate = true
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
  }, [model])

  return <primitive object={model} />
}

// 현재 장착 중인 전차를 전시대 위에 세워 천천히 돌린다. 전투용 Turret.tsx와 달리 조준/반동/
// 발사 로직은 전혀 없다 — 격납고에서는 그냥 정적 전시물이다(포탑/포신 관절도 고정).
function VehicleDisplay() {
  const equippedVehicleId = useGameStore((s) => s.equippedVehicleId)
  const asset = getVehicleRender(equippedVehicleId)
  const { scene, animations } = useGLTF(asset.modelUrl)
  const model = useMemo(() => scene.clone(true), [scene])
  const { actions } = useAnimations(animations, model)
  const spinRef = useRef<Group>(null)
  const cycleTimerRef = useRef(0)

  useEffect(() => {
    model.traverse((obj) => {
      if ((obj as Mesh).isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })
  }, [model])

  // 전시 클립은 한 번 재생하고 끝 프레임에서 멈춰 있다가(clampWhenFinished), 일정 주기로
  // 처음부터 다시 재생해서 "가끔 한 번씩 쏴 보여주는" 느낌을 준다.
  useEffect(() => {
    cycleTimerRef.current = 0
    Object.values(actions).forEach((action) => {
      if (!action) return
      action.setLoop(LoopOnce, 1)
      action.clampWhenFinished = true
      action.play()
    })
  }, [actions])

  useFrame((_, delta) => {
    if (spinRef.current) spinRef.current.rotation.y += SPIN_SPEED * delta

    cycleTimerRef.current += delta
    if (cycleTimerRef.current >= SHOWCASE_CYCLE_SEC) {
      cycleTimerRef.current = 0
      Object.values(actions).forEach((action) => action?.reset().play())
    }
  })

  return (
    <group ref={spinRef} scale={asset.scale}>
      <primitive object={model} />
    </group>
  )
}

function HangarCamera({ scene }: { scene: Object3D }) {
  const { camPosition, camQuaternion, fov, near, far } = useHangarRefPoints(scene)
  return (
    <PerspectiveCamera
      makeDefault
      position={camPosition}
      quaternion={[camQuaternion.x, camQuaternion.y, camQuaternion.z, camQuaternion.w]}
      fov={fov}
      near={near}
      far={far}
    />
  )
}

function HangarContents() {
  const { scene } = useGLTF(HANGAR_MODEL_URL)
  const { spotPosition, spotQuaternion } = useHangarRefPoints(scene)

  return (
    <>
      <HangarCamera scene={scene} />
      <ambientLight color={0xffb070} intensity={0.35} />
      <directionalLight color={0xffc890} intensity={1.2} position={[8, 10, 14]} />
      <directionalLight color={0x8fb0d0} intensity={0.4} position={[0, 6, -20]} />
      <HangarBackground />
      <group position={spotPosition} quaternion={[spotQuaternion.x, spotQuaternion.y, spotQuaternion.z, spotQuaternion.w]}>
        <VehicleDisplay />
      </group>
      <EffectComposer>
        <Bloom luminanceThreshold={0.8} mipmapBlur />
      </EffectComposer>
    </>
  )
}

// 무기고 배경 — HangarScreen.tsx(2D 카드 UI)가 이 위에 그대로 얹힌다(CombatHUD가 Scene.tsx
// 위에 얹히는 것과 같은 구조).
export function HangarScene() {
  return (
    <Canvas shadows>
      <HangarContents />
    </Canvas>
  )
}

useGLTF.preload(HANGAR_MODEL_URL)
