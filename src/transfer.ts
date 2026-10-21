import type { Backup, Course, Mode, State } from './types'
import { cetItems, freshState, getDay, modes, weekday } from './domain'
type Obj = Record<string, unknown>
const fail = (msg: string): never => { throw new Error('文件校验失败：' + msg) }
const obj = (v: unknown): Obj => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : fail('需要对象')
const str = (v: unknown, max = 10000): string => typeof v === 'string' && v.length <= max ? v : fail('文字过长或格式错误')
const title = (v: unknown) => { const s = str(v,200).trim(); return s ? s : fail('名称不能为空') }
const id = (v: unknown) => { const s = str(v, 200); return s && !['__proto__', 'prototype', 'constructor'].includes(s) ? s : fail('ID无效') }
const num = (v: unknown, min: number, max: number): number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fail('数字超出范围')
const bool = (v: unknown): boolean => typeof v === 'boolean' ? v : fail('需要布尔值')
const list = (v: unknown, max = 50000): unknown[] => Array.isArray(v) && v.length <= max ? v : fail('列表无效或过大')
const choice = <T extends string | number>(v: unknown, values: readonly T[]): T => values.includes(v as T) ? v as T : fail('选项无效')
export function validDate(v: unknown): string {
  const s = str(v, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s < '2000-01-01' || s > '2199-12-31') return fail('日期格式无效')
  const t = new Date(s + 'T00:00:00Z')
  return !isNaN(+t) && t.toISOString().slice(0, 10) === s ? s : fail('日期不存在')
}
function unique<T extends { id: string }>(arr: T[]): T[] {
  return new Set(arr.map(x => x.id)).size === arr.length ? arr : fail('同一列表有重复ID')
}
export const fingerprint = (s: string) => { let n = 2166136261; for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0).toString(36) }
function course(v: unknown): Course {
  const o = obj(v), day = num(o.day, -1, 6), s = str(o.s, 50)
  if (day >= 0 && !/^\d{1,2}[–\-—]\d{1,2}$/.test(s)) fail('课程节次应如 1–2')
  if (day >= 0) { const [a, b] = s.split(/[–\-—]/).map(Number); if (a < 1 || b < a || b > 20) fail('课程节次超出范围') }
  const weeks = list(o.weeks, 53).map(w => num(w, 1, 53))
  if (!weeks.length || new Set(weeks).size !== weeks.length) fail('有效周次不能为空或重复')
  const parsed = { day, s, name: title(o.name), weeks, type: choice(o.type, ['theory', 'digital', 'lab', 'activity', 'practice'] as const), note: str(o.note ?? '') }
  if (!parsed.name.trim()) fail('课程名称为空')
  return { id: o.id ? id(o.id) : 'course-' + fingerprint(JSON.stringify(parsed)), ...parsed }
}
export function parseState(input: unknown): State {
  const o = obj(input)
  if (o.schemaVersion !== 1 && o.schemaVersion !== 2) fail('不支持的数据版本，请更新应用')
  const v1 = o.schemaVersion === 1, settings = obj(o.settings)
  const semesterStart = settings.semesterStart === '' ? '' : validDate(settings.semesterStart)
  if (semesterStart && weekday(semesterStart) !== 0) fail('开学日期必须为周一')
  const plans = unique(list(o.plans, 1000).map(v => { const p = obj(v); return { id: id(p.id), title: title(p.title), tone: choice(p.tone, ['blue', 'mint', 'lilac', 'peach'] as const) } }))
  const tasks = unique(list(o.tasks).map(v => {
    const t = obj(v)
    return { id: id(t.id), title: title(t.title), planId: id(t.planId), minutes: num(t.minutes, 1, 1440), start: validDate(t.start), repeat: choice(t.repeat, ['none', 'daily', 'weekdays', 'weekly'] as const), note: str(t.note), ...(t.end ? { end: validDate(t.end) } : {}) }
  }))
  const days = Object.create(null) as State['days']
  const entries = Object.entries(obj(o.days)); if (entries.length > 50000) fail('日期数量过多')
  for (const [key, value] of entries) {
    validDate(key)
    const d = obj(value); if (d.date !== key) fail('日期键与记录不一致')
    days[key] = { date: key, mode: choice(d.mode, modes), note: str(d.note), items: unique(list(d.items, 5000).map(v => {
      const t = obj(v)
      return { id: id(t.id), title: title(t.title), planId: id(t.planId), minutes: num(t.minutes, 1, 1440), note: str(t.note), done: bool(t.done), actual: num(t.actual ?? (v1 ? 0 : undefined), 0, 1440), context: choice(t.context ?? (v1 ? 'self' : undefined), ['self', 'class'] as const), ...(t.sourceId ? { sourceId: id(t.sourceId) } : {}), ...(t.cet ? { cet: str(t.cet, 50) } : {}), ...(t.removed !== undefined ? { removed: bool(t.removed) } : {}) }
    })) }
    if (days[key].items.reduce((sum,t) => sum + t.actual,0) > 1440) fail('单日实际学习时长不能超过1440分钟')
  }
  const result: State = {
    schemaVersion: 2,
    settings: { semesterStart, examDate: validDate(settings.examDate), theme: choice(settings.theme, ['system', 'light', 'dark'] as const), cetEnabled: bool(settings.cetEnabled) },
    plans, tasks, days, courses: unique(list(o.courses, 5000).map(course)), uncertainNotes: list(o.uncertainNotes, 1000).map(x => str(x)),
    weekPlan: list(o.weekPlan ?? [], 200).map(v => { const w = obj(v); return { week: num(w.week, 1, 53), start: validDate(w.start), end: validDate(w.end), name: str(w.name, 200), desc: str(w.desc) } }),
    progress: unique(list(o.progress, 5000).map(v => { const p = obj(v); const completed = num(p.completed, 0, 100000), total = num(p.total, 0, 100000); if (completed > total) fail('网课完成数超过总数'); return { id: id(p.id), name: str(p.name, 200), chapter: str(p.chapter, 500), completed, total, next: str(p.next), note: str(p.note) } })),
    scores: unique(list(o.scores).map(v => { const s = obj(v); return { id: id(s.id), date: validDate(s.date), paper: str(s.paper, 200), listening: num(s.listening, 0, 25), reading: num(s.reading, 0, 30), writing: bool(s.writing ?? (v1 ? false : undefined)), translation: bool(s.translation ?? (v1 ? false : undefined)), note: str(s.note) } }))
  }
  if (tasks.some(t => !plans.some(p => p.id === t.planId))) fail('任务所属计划不存在')
  return result
}
export interface Imported { kind: 'backup' | 'schedule' | 'legacy'; state: State; summary: string }
export function parseImport(text: string): Imported {
  if (text.length > 10 * 1024 * 1024) fail('文件超过10MB')
  const o = obj(JSON.parse(text))
  if (o.app === 'studyflow-legacy') return legacy(obj(o.data))
  if (o.app === 'studyflow') {
    choice(o.schemaVersion, [1, 2]); const state = parseState(o.data)
    return { kind: 'backup', state, summary: `${Object.keys(state.days).length} 天记录 · ${state.tasks.length} 个任务 · ${state.courses.length} 门次课程 · ${state.scores.length} 次真题` }
  }
  if (o.schemaVersion !== 1 || o.timezone !== 'Asia/Shanghai') fail('不是支持的拾光备份或课表')
  const state = freshState()
  state.settings.semesterStart = validDate(o.semesterStart)
  if (weekday(state.settings.semesterStart) !== 0) fail('开学日期必须为周一')
  state.settings.examDate = validDate(o.examDate)
  state.courses = unique(list(o.courses, 5000).map(course))
  state.uncertainNotes = list(o.uncertainNotes ?? [], 1000).map(x => str(x))
  state.weekPlan = list(o.weekPlan ?? [], 200).map(v => { const w = obj(v); return { week: num(w.week, 1, 53), start: validDate(w.start), end: validDate(w.end), name: str(w.name, 200), desc: str(w.desc) } })
  return { kind: 'schedule', state, summary: `${state.courses.length} 门次课程 · ${state.uncertainNotes.length} 条待核实提醒 · ${state.weekPlan.length} 周学习建议。只保存在此设备。` }
}
export const exportBackup = (s: State): Backup => ({ app: 'studyflow', schemaVersion: 2, exportedAt: new Date().toISOString(), data: s })
const mergeList = <T extends { id: string }>(a: T[], b: T[]) => [...a, ...b.filter(x => !a.some(y => y.id === x.id))]
export function mergeImport(current: State, imported: Imported, replace: boolean): State {
  const incoming = imported.state
  if (imported.kind === 'schedule') return { ...current, settings: { ...current.settings, semesterStart: incoming.settings.semesterStart, examDate: incoming.settings.examDate }, courses: replace ? incoming.courses : mergeList(current.courses, incoming.courses), uncertainNotes: replace ? incoming.uncertainNotes : [...new Set([...current.uncertainNotes, ...incoming.uncertainNotes])], weekPlan: incoming.weekPlan }
  if (replace) return incoming
  const days = { ...incoming.days, ...current.days }
  for (const [date, d] of Object.entries(current.days)) if (incoming.days[date]) days[date] = { ...d, items: mergeList(d.items, incoming.days[date].items) }
  return { ...current, settings: { ...current.settings, semesterStart: current.settings.semesterStart || incoming.settings.semesterStart }, plans: mergeList(current.plans, incoming.plans), tasks: mergeList(current.tasks, incoming.tasks), days, courses: mergeList(current.courses, incoming.courses), progress: mergeList(current.progress, incoming.progress), scores: mergeList(current.scores, incoming.scores), uncertainNotes: [...new Set([...current.uncertainNotes, ...incoming.uncertainNotes])], weekPlan: current.weekPlan.length ? current.weekPlan : incoming.weekPlan }
}
function legacy(data: Obj): Imported {
  const state = freshState()
  const value = (key: string) => typeof data[key] === 'string' ? JSON.parse(data[key] as string) : data[key]
  const dates = new Set(Object.keys(data).flatMap(k => k.match(/^cet26_(?:mode|note|checked)_(\d{4}-\d{2}-\d{2})/)?.[1] ?? []))
  for (const d of dates) {
    validDate(d)
    const rawMode = value('cet26_mode_' + d), mode: Mode = rawMode === undefined ? getDay(state, d).mode : choice(rawMode, modes)
    const day = { ...getDay(state, d), mode, items: cetItems(mode), note: str(value('cet26_note_' + d) ?? '') }
    for (const m of modes) {
      const checked = value(`cet26_checked_${d}_${m}`)
      if (!checked) continue
      const items = cetItems(m)
      for (const index of list(checked, 10)) {
        const item = items[num(index, 0, items.length - 1)]
        const old = day.items.find(t => t.id === item.id)
        if (old) old.done = true; else day.items.push({ ...item, done: true })
      }
    }
    state.days[d] = day
  }
  state.scores = list(value('cet26_records') ?? []).map((v, i) => { const x = obj(v); return { id: 'legacy-score-' + fingerprint(JSON.stringify(x) + i), date: validDate(x.date), paper: '旧版摸底（未记录套次）', listening: num(x.l, 0, 25), reading: num(x.r, 0, 30), writing: false, translation: false, note: '旧版未记录实际时长、写作或翻译状态。' } })
  return { kind: 'legacy', state, summary: `${dates.size} 天旧记录 · ${state.scores.length} 次摸底。不同档位勾选取并集；实际时长保持未记录。` }
}
