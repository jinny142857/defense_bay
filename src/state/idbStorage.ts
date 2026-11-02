import type { StateStorage } from 'zustand/middleware'

// PRD 9.1/9.5: v1은 서버 없이 로컬(IndexedDB)에만 진행 상황을 저장한다.
const DB_NAME = 'bangpaje-defense'
const STORE_NAME = 'kv'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// App.tsx가 하이드레이션 직후 "이어하기"와 "새 세션"을 구분하는 데 쓴다.
export let hadSavedState = false

export const idbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const db = await openDb()
      const value = await new Promise<string | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const req = tx.objectStore(STORE_NAME).get(name)
        req.onsuccess = () => resolve((req.result as string | undefined) ?? null)
        req.onerror = () => reject(req.error)
      })
      hadSavedState = value != null
      return value
    } catch {
      // 사생활 보호 모드 등으로 IndexedDB를 못 쓰면 새 세션으로 취급
      return null
    }
  },
  setItem: async (name, value) => {
    try {
      const db = await openDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).put(value, name)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch {
      // 저장 실패는 조용히 무시 — 다음 상태 변경 때 다시 시도된다
    }
  },
  removeItem: async (name) => {
    try {
      const db = await openDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).delete(name)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch {
      // ignore
    }
  },
}
