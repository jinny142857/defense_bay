import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three'
import { beamTexture } from './vfxTextures'

const TRACER_LIFETIME_SEC = 0.12
const BEAM_WIDTH = 0.16

// 포탄 궤적(예광탄): 예전엔 LineBasicMaterial 1px 선이라 화면에서 거의 안 보였다. 발사 지점과
// 명중 지점을 잇는, 카메라를 향해 서 있는 길쭉한 빛줄기 평면을 직접 지오메트리로 만들어서
// 확실히 눈에 띄는 "포탄이 날아가는 모습"으로 바꾼다.
export function Projectile({
  from,
  to,
  onDone,
}: {
  from: [number, number, number]
  to: [number, number, number]
  onDone: () => void
}) {
  const [age, setAge] = useState(0)
  const { camera } = useThree()
  const mesh = useMemo(() => {
    const fromVec = new Vector3(...from)
    const toVec = new Vector3(...to)
    const dir = new Vector3().subVectors(toVec, fromVec)
    dir.normalize()

    const mid = new Vector3().addVectors(fromVec, toVec).multiplyScalar(0.5)
    const viewDir = new Vector3().subVectors(camera.position, mid).normalize()
    const side = new Vector3().crossVectors(dir, viewDir)
    if (side.lengthSq() < 1e-6) side.set(0, 1, 0).cross(dir)
    side.normalize().multiplyScalar(BEAM_WIDTH / 2)

    const p0 = fromVec.clone().add(side)
    const p1 = fromVec.clone().sub(side)
    const p2 = toVec.clone().add(side)
    const p3 = toVec.clone().sub(side)

    const geometry = new BufferGeometry()
    const positions = new Float32Array([
      p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z,
      p1.x, p1.y, p1.z, p3.x, p3.y, p3.z, p2.x, p2.y, p2.z,
    ])
    const uvs = new Float32Array([0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1])
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2))

    const material = new MeshBasicMaterial({
      map: beamTexture,
      transparent: true,
      opacity: 1,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const m = new Mesh(geometry, material)
    m.frustumCulled = false
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const meshRef = useRef(mesh)

  useFrame((_, delta) => {
    const next = age + delta
    setAge(next)
    const mat = meshRef.current.material as MeshBasicMaterial
    mat.opacity = Math.max(0, 1 - next / TRACER_LIFETIME_SEC)
    if (next >= TRACER_LIFETIME_SEC) onDone()
  })

  return <primitive object={mesh} ref={meshRef} />
}
