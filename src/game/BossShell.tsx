import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { Group } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { balance } from '../config/balance'
import { raycastTargets } from './raycastRegistry'

// 보스가 방파제로 쏘는 포탄(PRD 5.3 "파도 공격"을 실제 눈에 보이는 발사체로 구현) — 전조 경고
// 뒤 보스 쪽에서 날아올라 포물선을 그리며 방파제로 떨어진다. 탱크로 맞히면 격추해서 피해를
// 막을 수 있고(onHit), 못 맞히고 도착하면 onLand가 호출돼 방파제가 피해를 입는다.
// ARC_HEIGHT가 너무 크면(예전 9) 포물선 한가운데 즈음에서 카메라 시야각 위로 벗어나 안 보이게
// 된다 — 특히 카메라에 가까워질수록(명중 지점이 바로 코앞) 화면에 들어오는 세로 폭 자체가
// 좁아지는데, 포물선 정점의 세계 좌표 높이는 그대로라 그 좁아진 창 밖으로 솟아버린다. 고정
// 카메라(CAMERA_HOME)·발사/착탄 좌표 기준으로 끝까지 화면 안에 머물도록 낮게 눌렀다.
const ARC_HEIGHT = 2.5
const CORE_RADIUS = 0.55
const LOOKAHEAD_SEC = 0.05
const REFERENCE_DISTANCE = 15

const fromVec = new Vector3()
const toVec = new Vector3()
const tmpPos = new Vector3()
const tmpLookAhead = new Vector3()

function computePosition(out: Vector3, from: [number, number, number], to: [number, number, number], t: number) {
  const clamped = Math.min(1, Math.max(0, t))
  fromVec.set(...from)
  toVec.set(...to)
  out.copy(fromVec).lerp(toVec, clamped)
  out.y += Math.sin(clamped * Math.PI) * ARC_HEIGHT
  return out
}

export function BossShell({
  from,
  to,
  onHit,
  onLand,
}: {
  from: [number, number, number]
  to: [number, number, number]
  // 플레이어가 조준해 쏜 경우: 쿨다운을 통과해 실제로 발사됐으면 true (부모가 격추 처리).
  onHit: (point: [number, number, number]) => boolean
  onLand: (point: [number, number, number]) => void
}) {
  const groupRef = useRef<Group>(null)
  const doneRef = useRef(false)
  const [age, setAge] = useState(0)
  const { camera } = useThree()

  useEffect(() => {
    const g = groupRef.current
    if (!g) return
    raycastTargets.add(g)
    return () => {
      raycastTargets.delete(g)
    }
  }, [])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (doneRef.current || !group) return
    const next = age + delta
    setAge(next)

    const flightSec = balance.boss.shellFlightSec
    const t = next / flightSec
    computePosition(tmpPos, from, to, t)
    group.position.copy(tmpPos)
    computePosition(tmpLookAhead, from, to, t + LOOKAHEAD_SEC / flightSec)
    if (tmpLookAhead.distanceToSquared(tmpPos) > 1e-6) group.lookAt(tmpLookAhead)

    const distanceBoost = Math.max(1, camera.position.distanceTo(tmpPos) / REFERENCE_DISTANCE)
    group.scale.setScalar(distanceBoost)

    if (t >= 1) {
      doneRef.current = true
      onLand([tmpPos.x, tmpPos.y, tmpPos.z])
    }
  })

  const handleClick = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (doneRef.current || !groupRef.current) return
    const p = groupRef.current.position
    if (!onHit([p.x, p.y, p.z])) return
    doneRef.current = true
  }

  return (
    <group ref={groupRef} position={from} onPointerDown={handleClick} userData={{ hittable: true }}>
      <mesh>
        <sphereGeometry args={[CORE_RADIUS, 12, 12]} />
        <meshStandardMaterial color="#2b1208" emissive="#ff6a2b" emissiveIntensity={3} roughness={0.6} />
      </mesh>
      {/* 날아가는 방향 반대쪽으로 길게 뻗은 화염 꼬리 — 콘 지오메트리 기본 축(+Y)을 로컬 -Z(진행
          방향)의 반대쪽, 즉 +Z로 돌려서 "뒤로 끌리는 불꽃"처럼 보이게 한다. */}
      <mesh position={[0, 0, 1.1]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[CORE_RADIUS * 0.9, 2.2, 10]} />
        <meshBasicMaterial color="#ff9a3d" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <pointLight color="#ff7a3d" intensity={14} distance={9} />
      {/* 빠르게 날아가는 작은 목표라 맞히기 어렵다는 피드백(Mob/SupplyBox와 같은 이유) — 보이지
          않는 넉넉한 구 히트박스를 겹쳐 클릭 판정을 관대하게 한다. */}
      <mesh>
        <sphereGeometry args={[2.2, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
