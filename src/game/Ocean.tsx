import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Color, PlaneGeometry, ShaderMaterial } from 'three'

const VERTEX_SHADER = `
  uniform float uTime;
  varying float vHeight;

  void main() {
    vec3 pos = position;
    float wave =
      sin(pos.x * 0.18 + uTime * 1.1) * 0.22 +
      sin(pos.y * 0.26 - uTime * 0.8) * 0.16 +
      sin((pos.x + pos.y) * 0.08 + uTime * 0.5) * 0.3;
    pos.z += wave;
    vHeight = wave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const FRAGMENT_SHADER = `
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uFoamColor;
  varying float vHeight;

  void main() {
    float t = clamp(vHeight * 1.6 + 0.5, 0.0, 1.0);
    vec3 base = mix(uDeepColor, uShallowColor, t);
    float foam = smoothstep(0.55, 0.75, vHeight);
    vec3 color = mix(base, uFoamColor, foam * 0.5);
    gl_FragColor = vec4(color, 1.0);
  }
`

// M2: 사인파 변위 셰이더로 일렁이는 바다 표현 (PRD 7.4의 실시간 물 셰이더는 추후 반사/굴절까지 확장).
export function Ocean({ onPointerDown }: { onPointerDown?: (e: ThreeEvent<PointerEvent>) => void }) {
  const geometry = useMemo(() => new PlaneGeometry(300, 300, 64, 64), [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uDeepColor: { value: new Color('#0c3a52') },
          uShallowColor: { value: new Color('#2f8fb0') },
          uFoamColor: { value: new Color('#d8f3f6') },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
      }),
    [],
  )

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta
  })

  return (
    <mesh
      position={[0, -1, -40]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onPointerDown={onPointerDown}
      geometry={geometry}
      material={material}
    />
  )
}
