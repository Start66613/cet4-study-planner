import type { State } from './types'
import { freshState } from './domain'
import { parseState } from './transfer'
const DB = 'studyflow-local'
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2)
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('state')) req.result.createObjectStore('state') }
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('请关闭其他拾光窗口后重试'))
    req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); resolve(req.result) }
  })
}
export async function readState(): Promise<State> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('state').objectStore('state').get('main')
    req.onsuccess = () => { try { resolve(req.result ? parseState(req.result) : freshState()) } catch (e) { reject(e) } finally { db.close() } }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}
export async function writeState(state: State): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite')
    tx.objectStore('state').put(state, 'main')
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('保存失败')) }
  })
}
// The read-modify-write happens in one transaction, including on browsers without Web Locks.
// IndexedDB serializes readwrite transactions across tabs, preventing lost updates.
export async function updateState(mutator: (current: State) => State): Promise<State> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite'), store = tx.objectStore('state')
    const req = store.get('main')
    let next: State, failure: unknown
    req.onsuccess = () => {
      try { const current = req.result ? parseState(req.result) : freshState(); next = parseState(mutator(current)); store.put(next, 'main') }
      catch (e) { failure = e; tx.abort() }
    }
    tx.oncomplete = () => { db.close(); resolve(next) }
    tx.onerror = tx.onabort = () => { db.close(); reject(failure ?? tx.error ?? new Error('保存事务失败')) }
  })
}
