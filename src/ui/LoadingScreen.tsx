// PRD 7.3: 도트 그리드 금속 배경 + 해저드 스트라이프 + 중앙 발광 'LOADING ···' 태그.
export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-screen__stripe">
        <div className="loading-screen__tag">LOADING &middot;&middot;&middot;</div>
      </div>
    </div>
  )
}
