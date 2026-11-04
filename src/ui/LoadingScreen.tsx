// PRD 7.3: 도트 그리드 금속 배경 + 해저드 스트라이프 + 중앙 발광 'LOADING ···' 태그.
// 텍스트만 떠 있으면 멈춰있는 것처럼 보여서, 실제로 채워지는 진행 바를 태그 아래에 더했다.
export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-screen__stripe">
        <div className="loading-screen__panel">
          <div className="loading-screen__tag">LOADING &middot;&middot;&middot;</div>
          <div className="loading-screen__bar">
            <div className="loading-screen__bar-fill" />
          </div>
        </div>
      </div>
    </div>
  )
}
