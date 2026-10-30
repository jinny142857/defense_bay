import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial } from 'three'

const TRACER_LIFETIME_SEC = 0.12

// M1 임시 이펙트: 실제 포구 화염/탄착 이펙트(PRD 7.4)는 이후 마일스톤에서 교체한다.
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
  const line = useMemo(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute([...from, ...to], 3))
    const material = new LineBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 1 })
    return new Line(geometry, material)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const lineRef = useRef(line)

  useFrame((_, delta) => {
    const next = age + delta
    setAge(next)
    const mat = lineRef.current.material as LineBasicMaterial
    mat.opacity = Math.max(0, 1 - next / TRACER_LIFETIME_SEC)
    if (next >= TRACER_LIFETIME_SEC) onDone()
  })

  return <primitive object={line} ref={lineRef} />
}
