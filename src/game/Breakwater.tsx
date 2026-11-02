// M1 임시 도형: 콘크리트 테트라포드(PRD 7.4)는 이후 마일스톤에서 교체한다.
// 레퍼런스처럼 폭은 화면 전체를 덮을 만큼 넓게, 높이는 얇은 띠로 — 탱크가 그 위로 높이 솟아야 한다.
const DECK_TOP = 1.0
const LIP_TOP = DECK_TOP + 0.15

export function Breakwater() {
  return (
    <>
      {/* 밝은 콘크리트 몸체: 화면 전체 폭을 덮는다 */}
      <mesh position={[0, DECK_TOP - 0.75, -2]} castShadow receiveShadow>
        <boxGeometry args={[30, 1.5, 10]} />
        <meshStandardMaterial color="#9a9488" roughness={0.85} />
      </mesh>
      {/* 바다 쪽 끝단의 얇고 어두운 캡(파도에 젖어 어두워진 테두리) */}
      <mesh position={[0, LIP_TOP - 0.15, -6.85]} castShadow receiveShadow>
        <boxGeometry args={[30, 0.3, 0.3]} />
        <meshStandardMaterial color="#2b2a26" roughness={0.9} />
      </mesh>
    </>
  )
}
