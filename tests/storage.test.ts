import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { readState, updateState, writeState } from '../src/storage'
import { freshState, makeDay } from '../src/domain'
it('persists history, notes, cancellations and actual time after reopening IndexedDB', async () => {
  const s = freshState(); s.days['2026-10-21'] = makeDay(s,'2026-10-21')
  s.days['2026-10-21'].items[0].done = true; s.days['2026-10-21'].note = '演示历史'; s.days['2026-10-21'].items[0].actual = 9
  await writeState(s)
  const read = await readState(); expect(read).toEqual(s)
  read.days['2026-10-21'].items[0].done = false; await writeState(read)
  expect((await readState()).days['2026-10-21'].items[0].done).toBe(false)
  expect((await readState()).days['2026-10-21'].items[0].actual).toBe(9)
})
it('serializes competing updates and rejects invalid writes without overwriting data', async () => {
  const s = freshState(); s.days['2026-10-21'] = makeDay(s,'2026-10-21'); await writeState(s)
  await Promise.all([0,1].map(index => updateState(current => {
    current.days['2026-10-21'].items[index].done = true; return current
  })))
  expect((await readState()).days['2026-10-21'].items.filter(x => x.done)).toHaveLength(2)
  await expect(updateState(current => { current.days['2026-10-21'].items[0].actual = -1; return current })).rejects.toThrow()
  expect((await readState()).days['2026-10-21'].items[0].actual).toBe(0)
})
it('upgrades an existing version 1 database and keeps its saved history', async () => {
  await new Promise<void>((resolve,reject) => { const req=indexedDB.deleteDatabase('studyflow-local'); req.onsuccess=()=>resolve(); req.onerror=()=>reject(req.error) })
  const old = freshState(); old.days['2026-10-21'] = makeDay(old,'2026-10-21'); old.days['2026-10-21'].items[0].done = true
  const raw = JSON.parse(JSON.stringify(old)); raw.schemaVersion = 1; delete raw.days['2026-10-21'].items[0].context; delete raw.days['2026-10-21'].items[0].actual
  const db = await new Promise<IDBDatabase>((resolve,reject) => { const req=indexedDB.open('studyflow-local',1); req.onupgradeneeded=()=>req.result.createObjectStore('state'); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error) })
  await new Promise<void>((resolve,reject) => { const tx=db.transaction('state','readwrite'); tx.objectStore('state').put(raw,'main'); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error) }); db.close()
  const recovered = await readState()
  expect(recovered.schemaVersion).toBe(2)
  expect(recovered.days['2026-10-21'].items[0]).toMatchObject({ done:true,actual:0,context:'self' })
  await updateState(s=>s)
  expect((await readState()).days['2026-10-21'].items[0].done).toBe(true)
})
