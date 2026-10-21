import { describe, expect, it } from 'vitest'
import { addDays, applyTask, cetItems, changeMode, dayStats, deleteTask, freshState, getDay, isDue, makeDay, periodStats, streak, today, weekday, weekNumber } from '../src/domain'
import type { Task } from '../src/types'
describe('Shanghai dates and teaching weeks', () => {
  it('changes date exactly at Shanghai midnight irrespective of host time zone', () => {
    expect(today(new Date('2026-10-20T15:59:59Z'))).toBe('2026-10-20')
    expect(today(new Date('2026-10-20T16:00:00Z'))).toBe('2026-10-21')
    expect(weekday('2026-10-21')).toBe(2)
  })
  it('supports week boundaries, blank calendars and new semesters', () => {
    const start = '2026-01-05'
    for (const w of [8, 10, 11, 13, 15]) {
      const monday = addDays(start, (w - 1) * 7)
      expect(weekNumber(monday, start)).toBe(w)
      expect(weekNumber(addDays(monday, 6), start)).toBe(w)
      expect(weekNumber(addDays(monday, 7), start)).toBe(w + 1)
    }
    expect(weekNumber('2026-01-04', start)).toBeNull()
    expect(weekNumber(start, '')).toBeNull()
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})
describe('daily plans and immutable history', () => {
  it.each([30,45,60,90,120] as const)('%s minute presets have the exact duration', mode => {
    const items = cetItems(mode)
    expect(items.reduce((n, t) => n + t.minutes, 0)).toBe(mode)
    expect(items.filter(t => ['listen', 'read'].includes(t.cet!)).reduce((n,t) => n + t.minutes, 0)).toBeGreaterThanOrEqual(mode / 2)
  })
  it('retains completed and time-logged items while switching both directions', () => {
    const state = freshState(), day = makeDay(state, '2026-10-21')
    day.items[0].done = true; day.items[1].actual = 17
    const next = changeMode(day, 30), large = changeMode(next, 120)
    expect(next.items[0].done).toBe(true)
    expect(large.items[0].minutes).toBe(day.items[0].minutes)
    expect(large.items.find(t => t.cet === 'listen')!.actual).toBe(17)
    const read = day.items.find(t => t.cet === 'read')!; read.done = true
    expect(changeMode(day, 30).items.find(t => t.cet === 'read')!.done).toBe(true)
  })
  it('does not invent actual duration or share status with another date', () => {
    const s = freshState(), a = makeDay(s, '2026-10-21'); a.items[0].done = true
    s.days[a.date] = a
    expect(getDay(s, '2026-10-22').items[0].done).toBe(false)
    expect(dayStats(a).actual).toBe(0)
    a.items[0].context = 'class'; a.items[0].actual = 12
    expect(dayStats(a).actual).toBe(12)
  })
  it('continues after exam without generating new exam tasks', () => {
    const s = freshState()
    expect(makeDay(s, s.settings.examDate).items).toHaveLength(0)
    expect(makeDay(s, '2027-01-05').items).toHaveLength(0)
  })
  const task: Task = { id:'demo', title:'演示习惯', planId:'life', start:'2026-10-19', minutes:10, repeat:'daily', note:'' }
  it('creates, edits and stops a recurring task without changing history', () => {
    let s = applyTask(freshState(), task, task.start)
    for (const d of ['2026-10-19','2026-10-20','2026-10-21']) s.days[d] = makeDay(s,d)
    s.days['2026-10-20'].items.find(x => x.id === task.id)!.done = true
    s = applyTask(s, { ...task, title:'新标题' }, '2026-10-20')
    expect(s.days['2026-10-19'].items.find(x => x.id === task.id)!.title).toBe('演示习惯')
    expect(s.days['2026-10-20'].items.find(x => x.id === task.id)!.title).toBe('演示习惯')
    expect(s.days['2026-10-21'].items.find(x => x.id === task.id)!.title).toBe('新标题')
    s = deleteTask(s, task.id, '2026-10-20')
    expect(s.days['2026-10-20'].items.some(x => x.id === task.id)).toBe(true)
    expect(s.days['2026-10-21'].items.some(x => x.id === task.id)).toBe(false)
    expect(makeDay(s, '2026-10-22').items.some(x => x.id === task.id)).toBe(false)
  })
  it('handles weekly, weekday and one-time recurrences', () => {
    expect(isDue({ ...task, repeat:'weekly' }, '2026-10-26')).toBe(true)
    expect(isDue({ ...task, repeat:'weekly' }, '2026-10-27')).toBe(false)
    expect(isDue({ ...task, repeat:'none' }, '2026-10-20')).toBe(false)
    expect(isDue({ ...task, repeat:'weekdays' }, '2026-10-24')).toBe(false)
  })
  it('counts an activity streak without requiring all tasks completed', () => {
    const s = freshState()
    for (const date of ['2026-10-19','2026-10-20']) { s.days[date] = makeDay(s,date); s.days[date].items[0].done = true }
    expect(streak(s,'2026-10-21')).toBe(2)
    expect(streak(s,'2026-10-22')).toBe(0)
  })
  it('uses only saved records within a selected week', () => {
    const s = freshState()
    s.days['2026-10-21'] = makeDay(s,'2026-10-21'); s.days['2026-10-21'].items[0].done = true; s.days['2026-10-21'].items[0].actual = 12
    s.days['2026-10-28'] = makeDay(s,'2026-10-28'); s.days['2026-10-28'].items[0].actual = 20
    expect(periodStats(s,'2026-10-19','2026-10-25')).toEqual({ total:3,done:1,actual:12 })
    expect(periodStats(s,'2026-10-12','2026-10-18')).toEqual({total:0,done:0,actual:0})
  })
})
