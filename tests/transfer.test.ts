import { describe, expect, it } from 'vitest'
import { exportBackup, mergeImport, parseImport, parseState, validDate } from '../src/transfer'
import { freshState, makeDay } from '../src/domain'
describe('backup validation, migration and duplicate handling', () => {
  it('round-trips a complete state', () => {
    const s = freshState(); s.days['2026-10-21'] = makeDay(s,'2026-10-21'); s.days['2026-10-21'].items[0].done = true
    const imported = parseImport(JSON.stringify(exportBackup(s)))
    expect(imported.kind).toBe('backup')
    expect(imported.state).toEqual(s)
  })
  it('is idempotent for duplicate backups and preserves local conflict values', () => {
    const s = freshState(); s.days['2026-10-21'] = makeDay(s,'2026-10-21')
    const incoming = structuredClone(s); incoming.days['2026-10-21'].items[0].done = true
    const imported = parseImport(JSON.stringify(exportBackup(incoming)))
    const merged = mergeImport(s,imported,false)
    expect(merged.days['2026-10-21'].items[0].done).toBe(false)
    expect(mergeImport(merged,imported,false)).toEqual(merged)
    expect(mergeImport(s,imported,true)).toEqual(incoming)
  })
  it('recovers an unset semester start on a new device during merge', () => {
    const incoming = freshState(); incoming.settings.semesterStart = '2026-01-05'
    const imported = parseImport(JSON.stringify(exportBackup(incoming)))
    expect(mergeImport(freshState(), imported, false).settings.semesterStart).toBe('2026-01-05')
    const local = freshState(); local.settings.semesterStart = '2026-02-02'
    expect(mergeImport(local, imported, false).settings.semesterStart).toBe('2026-02-02')
  })
  it('rejects broken files, unsupported versions, bad dates and wrong date keys', () => {
    expect(() => parseImport('{bad')).toThrow()
    expect(() => parseImport('{"app":"studyflow","schemaVersion":99}')).toThrow()
    expect(() => validDate('2026-02-30')).toThrow()
    expect(() => validDate('__proto__')).toThrow()
    const s = freshState(); s.days['2026-10-21'] = makeDay(s,'2026-10-22')
    expect(() => parseState(s)).toThrow(/日期键/)
  })
  it('rejects invalid task references, duplicate IDs and oversized numeric values', () => {
    const s = freshState(); s.plans.push(s.plans[0]); expect(() => parseState(s)).toThrow(/重复/)
    const other = freshState(); other.days['2026-10-21'] = makeDay(other,'2026-10-21'); other.days['2026-10-21'].items[0].actual = -1
    expect(() => parseState(other)).toThrow()
  })
  it('migrates version 1 by adding context and zero actual time', () => {
    const s = freshState(); s.days['2026-10-21'] = makeDay(s,'2026-10-21')
    const raw = JSON.parse(JSON.stringify(s)); raw.schemaVersion = 1
    delete raw.days['2026-10-21'].items[0].context; delete raw.days['2026-10-21'].items[0].actual
    expect(parseState(raw).days['2026-10-21'].items[0].context).toBe('self')
    expect(parseState(raw).schemaVersion).toBe(2)
  })
  it('imports a generic schedule using explicit weeks and preserving uncertainty', () => {
    const raw = { schemaVersion:1, timezone:'Asia/Shanghai', semesterStart:'2026-01-05', examDate:'2026-12-12', courses:[{day:0,s:'1–2',name:'演示课程',weeks:[2,4,6],type:'theory',note:'来源存在冲突，待核实'}], uncertainNotes:['实验日期待通知'] }
    const imported = parseImport(JSON.stringify(raw)); expect(imported.kind).toBe('schedule')
    expect(imported.state.courses[0].weeks).toEqual([2,4,6])
    const s = freshState(); s.days['2026-10-21'] = makeDay(s,'2026-10-21')
    const merged = mergeImport(s, imported, true)
    expect(merged.days).toEqual(s.days)
    expect(mergeImport(merged,imported,false).courses).toHaveLength(1)
    expect(merged.courses[0].note).toContain('待核实')
    expect(() => parseImport(JSON.stringify({ ...raw, semesterStart:'2026-01-06' }))).toThrow(/周一/)
  })
  it('imports legacy mode-specific checks as a union without inventing time', () => {
    const imported = parseImport(JSON.stringify({app:'studyflow-legacy',data:{cet26_mode_2026:'ignore', 'cet26_mode_2026-10-21':'60', 'cet26_checked_2026-10-21_30':'[2]', 'cet26_checked_2026-10-21_60':'[0]', 'cet26_note_2026-10-21':'"演示笔记"', cet26_records:'[{"date":"2026-10-21","l":12,"r":18}]'}}))
    const day = imported.state.days['2026-10-21']
    expect(day.items.filter(x => x.done)).toHaveLength(2)
    expect(day.items.every(x => x.actual === 0)).toBe(true)
    expect(imported.state.scores[0].listening).toBe(12)
    expect(day.note).toBe('演示笔记')
  })
})
