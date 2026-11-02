import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

const TRANSITION_MS = 260

// 화면 전환 시 해저드 스트라이프 셔터가 닫혔다 열리며 안쪽 화면을 교체한다.
// transitionKey가 바뀔 때만 셔터가 동작한다 — 같은 화면 그룹(예: 전투 중 보스 등장 오버레이) 안의
// 변화는 셔터 없이 바로 갱신된다.
export function ScreenTransition({ transitionKey, children }: { transitionKey: string; children: ReactNode }) {
  const [shownKey, setShownKey] = useState(transitionKey)
  const [covering, setCovering] = useState(false)
  const frozenNode = useRef<ReactNode>(children)

  if (transitionKey === shownKey) {
    frozenNode.current = children
  }

  useEffect(() => {
    if (transitionKey === shownKey) return
    setCovering(true)
    const t = window.setTimeout(() => {
      setShownKey(transitionKey)
      setCovering(false)
    }, TRANSITION_MS)
    return () => window.clearTimeout(t)
  }, [transitionKey, shownKey])

  return (
    <>
      {frozenNode.current}
      <div className={'shutter' + (covering ? ' shutter--closed' : '')} aria-hidden="true">
        <div className="shutter__panel shutter__panel--top" />
        <div className="shutter__panel shutter__panel--bottom" />
      </div>
    </>
  )
}
