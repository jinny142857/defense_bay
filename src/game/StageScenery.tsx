import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { Mesh, MeshStandardMaterial, Object3D } from 'three'
import { getWaveHeight } from './SeaWater.js'

// 스테이지 2/3 배경(SeaEnvironment_GameAssets)의 산호 바위섬·빙산 등 원경 지형 — Mountains.tsx와
// 같은 이유로 fog를 끄고 flatShading을 켠다(재질 색에 이미 거리감이 들어 있다).
// 'JellySwarm'(스테이지 2, 해파리 무리)과 'IceFloes'(스테이지 3, 유빙) 그룹이 있으면 파도를 따라
// 출렁이게 한다 — StageThemes.js의 animateScenery() 참고 구현.
export function StageScenery({ modelUrl, waveAmp }: { modelUrl: string; waveAmp: number }) {
  const { scene } = useGLTF(modelUrl)
  const model = useMemo(() => scene.clone(true), [scene])
  const baseYRef = useRef(new WeakMap<Object3D, number>())
  const scaleRef = useRef(new WeakMap<Object3D, number>())

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

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const swarm = model.getObjectByName('JellySwarm')
    const floes = model.getObjectByName('IceFloes')
    for (const group of [swarm, floes]) {
      if (!group) continue
      group.children.forEach((o, i) => {
        if (!baseYRef.current.has(o)) baseYRef.current.set(o, o.position.y)
        const baseY = baseYRef.current.get(o) ?? o.position.y
        o.position.y = baseY + getWaveHeight(o.position.x, o.position.z, t, waveAmp) * 0.8
        if (group === swarm) {
          if (!scaleRef.current.has(o)) scaleRef.current.set(o, o.scale.x)
          const baseScale = scaleRef.current.get(o) ?? o.scale.x
          o.scale.setScalar(baseScale * (1 + 0.06 * Math.sin(t * 2 + i)))
        } else {
          o.rotation.y += 0.0004 * ((i % 2) * 2 - 1)
        }
      })
    }
  })

  return <primitive object={model} />
}

useGLTF.preload('/assets/stage2-scenery.glb')
useGLTF.preload('/assets/stage3-scenery.glb')
