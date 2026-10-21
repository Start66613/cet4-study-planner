import type { Day, Item, Mode, State, Task } from './types'
export const weekdays = ['一', '二', '三', '四', '五', '六', '日']
export function today(now = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (s: string) => p.find(x => x.type === s)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export const epoch = (d: string) => Date.parse(d + 'T00:00:00Z')
export const addDays = (d: string, n: number) => new Date(epoch(d) + n * 86400000).toISOString().slice(0, 10)
export const diffDays = (a: string, b: string) => Math.round((epoch(a) - epoch(b)) / 86400000)
export const weekday = (d: string) => (new Date(epoch(d)).getUTCDay() + 6) % 7
export const weekNumber = (d: string, start: string) => start && d >= start ? Math.floor(diffDays(d, start) / 7) + 1 : null
export const monday = (d: string) => addDays(d, -weekday(d))
export const dateLabel = (d: string) => `${Number(d.slice(5, 7))}月${Number(d.slice(8))}日`
export const uid = () => crypto.randomUUID()
export const modes: Mode[] = [30, 45, 60, 90, 120]
const patterns: Record<Mode, [string, string, number, string][]> = {
  30: [['words', '高频词汇', 10, '复习旧词，记少量高频词。'], ['listen', '听力保底', 15, '真题一小段，对照原文回听错句。'], ['review', '错题复盘', 5, '回顾一个典型错误，写下原因。']],
  45: [['words', '高频词汇', 10, '旧词复习与高频新词。'], ['listen', '听力精练', 20, '做题、核对原文、回听错句。'], ['read', '阅读训练', 15, '练定位句与同义替换。']],
  60: [['words', '高频词汇', 15, '复习旧词，少量增加新词。'], ['listen', '听力精练', 25, '真题练习与错句复听。'], ['read', '阅读训练', 20, '仔细阅读或长篇匹配，先定位再作答。']],
  90: [['words', '高频词汇', 15, '新词与旧词滚动复习。'], ['listen', '听力精练', 30, '练真题，分析未听清的原因。'], ['read', '阅读训练', 30, '限时阅读，整理同义替换。'], ['review', '错题复盘', 15, '集中整理听力和阅读错因。']],
  120: [['words', '高频词汇', 20, '复习与语境记忆。'], ['listen', '听力精练', 35, '做题、订正、重听。'], ['read', '阅读训练', 40, '限时仔细阅读与匹配。'], ['write', '写作 / 翻译', 25, '交替练习写作和翻译，整理可复用表达。']]
}
export const freshState = (): State => ({
  schemaVersion: 2, settings: { semesterStart: '', examDate: '2026-12-12', theme: 'system', cetEnabled: true },
  plans: [{ id: 'cet', title: '英语四级', tone: 'blue' }, { id: 'major', title: '专业课学习', tone: 'lilac' }, { id: 'life', title: '日常习惯', tone: 'mint' }],
  tasks: [], days: {}, courses: [], uncertainNotes: [], weekPlan: [], progress: [], scores: []
})
export function isDue(t: Task, date: string) {
  return date >= t.start && (!t.end || date <= t.end) && (t.repeat === 'daily' || (t.repeat === 'none' && t.start === date) || (t.repeat === 'weekly' && weekday(date) === weekday(t.start)) || (t.repeat === 'weekdays' && weekday(date) < 5))
}
export function cetItems(mode: Mode): Item[] {
  return patterns[mode].map(([cet, title, minutes, note]) => ({ id: 'cet-' + cet, cet, title, minutes, note, planId: 'cet', done: false, actual: 0, context: 'self' }))
}
export function makeDay(s: State, date: string): Day {
  const mode = ([30, 60, 45, 30, 90, 120, 60] as Mode[])[weekday(date)]
  const custom: Item[] = s.tasks.filter(t => isDue(t, date)).map(t => ({ id: t.id, sourceId: t.id, title: t.title, planId: t.planId, minutes: t.minutes, note: t.note, done: false, actual: 0, context: 'self' }))
  return { date, mode, note: '', items: [...(s.settings.cetEnabled && date < s.settings.examDate ? cetItems(mode) : []), ...custom] }
}
export const getDay = (s: State, date: string) => s.days[date] ?? makeDay(s, date)
export const visibleItems = (day: Day) => day.items.filter(t => !t.removed)
export function changeMode(day: Day, mode: Mode): Day {
  const next = cetItems(mode)
  // A completed or time-logged item keeps its original duration and content across modes.
  const saved = day.items.filter(t => t.cet && (t.done || t.actual > 0))
  return { ...day, mode, items: [...next.map(t => saved.find(x => x.id === t.id) ?? t), ...saved.filter(t => !next.some(x => x.id === t.id)), ...day.items.filter(t => !t.cet)] }
}
export function applyTask(s: State, task: Task, from: string): State {
  const tasks = [...s.tasks.filter(t => t.id !== task.id), task]
  const days = Object.fromEntries(Object.entries(s.days).map(([date, day]) => {
    if (date < from) return [date, day]
    const old = day.items.find(x => x.sourceId === task.id)
    if (old?.done || (old?.actual ?? 0) > 0) return [date, day]
    const items = day.items.filter(x => x.sourceId !== task.id)
    if (isDue(task, date)) items.push({ id: task.id, sourceId: task.id, title: task.title, planId: task.planId, minutes: task.minutes, note: task.note, done: false, actual: 0, context: 'self' })
    return [date, { ...day, items }]
  }))
  return { ...s, tasks, days }
}
export function deleteTask(s: State, id: string, from: string): State {
  return { ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, end: addDays(from, -1) } : t), days: Object.fromEntries(Object.entries(s.days).map(([date, d]) => [date, date < from ? d : { ...d, items: d.items.filter(t => t.sourceId !== id || t.done || t.actual > 0) }])) }
}
export function dayStats(day?: Day) {
  const items = day ? visibleItems(day) : []
  return { total: items.length, done: items.filter(t => t.done).length, actual: day?.items.reduce((n, t) => n + t.actual, 0) ?? 0 }
}
export function periodStats(s: State, start: string, end: string) {
  return Object.entries(s.days).filter(([date]) => date >= start && date <= end).reduce((sum, [,day]) => {
    const st = dayStats(day)
    return { total: sum.total + st.total, done: sum.done + st.done, actual: sum.actual + st.actual }
  }, { total:0, done:0, actual:0 })
}
export function streak(s: State, date: string) {
  let n = 0, cursor = dayStats(s.days[date]).done ? date : addDays(date, -1)
  while (dayStats(s.days[cursor]).done > 0) { n++; cursor = addDays(cursor, -1) }
  return n
}
export const route = [
  ['2026-10-21', '2026-10-25', '摸底诊断', '完成一套真题，记录听力、阅读错因；确定需要补的基础。'],
  ['2026-10-26', '2026-11-08', '听力 · 阅读打底', '听力回听与仔细阅读优先，词汇放进真题语境中复习。'],
  ['2026-11-09', '2026-11-22', '专项提速 · 写译', '继续听读专项，每周各练两次写作和翻译，复盘典型错误。'],
  ['2026-11-23', '2026-12-06', '全真模拟', '每周一套限时真题，记录真实正确题数，针对薄弱项调整。'],
  ['2026-12-07', '2026-12-11', '考前温习', '减少新题，复习错题、句型，保持作息，核对证件与考场。']
]
