import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Vector3 } from 'three'
import type { Group } from 'three'

// 예광탄(평면 빛줄기) 대신 실제 포탄 모델이 포구에서 명중 지점까지 날아가는 걸 보여준다
// (TankMkII 가이드의 Shell_MkII.glb 전용) — 기존 Projectile.tsx와 같은 짧은 생존시간으로,
// 거의 순간적으로 날아가는 즉발 사격 손맛은 그대로 유지한다.
const FLIGHT_SEC = 0.12
const SCALE = 1.4

const fromVec = new Vector3()
const toVec = new Vector3()
const tmpPos = new Vector3()

export function ShellProjectile({
  modelUrl,
  from,
  to,
  onDone,
}: {
  modelUrl: string
  from: [number, number, number]
  to: [number, number, number]
  onDone: () => void
}) {
  const { scene } = useGLTF(modelUrl)
  // 포탄 모델의 정면(길쭉한 쪽, 로컬 +X)을 그룹의 lookAt 기준 전방(로컬 -Z)에 맞춘다.
  const model = useRef(
    (() => {
      const clone = scene.clone(true)
      clone.rotation.y = Math.PI / 2
      return clone
    })(),
  ).current
  const groupRef = useRef<Group>(null)
  const [age, setAge] = useState(0)

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    const next = age + delta
    setAge(next)
    const t = Math.min(1, next / FLIGHT_SEC)
    fromVec.set(...from)
    toVec.set(...to)
    tmpPos.copy(fromVec).lerp(toVec, t)
    group.position.copy(tmpPos)
    group.lookAt(toVec)
    if (next >= FLIGHT_SEC) onDone()
  })

  return (
    <group ref={groupRef} position={from} scale={SCALE}>
      <primitive object={model} />
      <pointLight color="#ffcf7a" intensity={4} distance={4} />
    </group>
  )
}
