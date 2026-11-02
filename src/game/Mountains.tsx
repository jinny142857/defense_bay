import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import type { Mesh, MeshStandardMaterial } from 'three'

const MODEL_URL = '/assets/mountains.glb'

// 원경 산 배경(SeaEnvironment_GameAssets 가이드). 재질에 거리별 공기원근 색이 이미 들어 있어
// scene.fog를 받으면 먼 산이 하늘색으로 사라지므로 fog를 꺼둔다.
export function Mountains() {
  const { scene } = useGLTF(MODEL_URL)
  const model = useMemo(() => scene.clone(true), [scene])

  useEffect(() => {
    model.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      const mat = mesh.material as MeshStandardMaterial
      mat.fog = false
      mat.flatShading = true
      mat.needsUpdate = true
    })
  }, [model])

  return <primitive object={model} />
}

useGLTF.preload(MODEL_URL)
