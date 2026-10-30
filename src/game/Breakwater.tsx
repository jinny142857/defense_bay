// M1 임시 도형: 콘크리트 테트라포드(PRD 7.4)는 이후 마일스톤에서 교체한다.
export function Breakwater() {
  return (
    <mesh position={[0, -0.5, -6]} castShadow receiveShadow>
      <boxGeometry args={[14, 1.4, 2]} />
      <meshStandardMaterial color="#5c5a52" roughness={0.9} />
    </mesh>
  )
}
