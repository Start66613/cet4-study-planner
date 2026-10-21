import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import type { Course, Item, Plan, Progress, Score, State, Task, Tone } from './types'
import { addDays, applyTask, deleteTask, getDay, today, uid, weekday } from './domain'
import { Field } from './ui'
export type Change = (fn: (s: State) => State, message?: string) => Promise<boolean>
const n = (data: FormData, k: string) => Number(data.get(k))
const s = (data: FormData, k: string) => String(data.get(k) ?? '').trim()
const Submit = ({ text = '保存' }: { text?: string }) => <button className="button primary full" type="submit">{text}</button>
export function TaskForm({ state, date, task, change, close }: { state: State; date: string; task?: Task; change: Change; close: () => void }) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const d = new FormData(e.currentTarget)
    const taskData: Task = { id: task?.id ?? uid(), title: s(d, 'title'), planId: s(d, 'planId'), minutes: n(d, 'minutes'), start: s(d, 'start'), repeat: s(d, 'repeat') as Task['repeat'], note: s(d, 'note') }
    if (!taskData.title) return
    const ok = await change(st => applyTask(st, taskData, task ? today() : taskData.start < today() ? taskData.start : today()), '任务已保存'); if (ok) close()
  }
  return <form onSubmit={submit} className="form-stack"><Field label="任务名称"><input name="title" required maxLength={200} defaultValue={task?.title} placeholder="给自己一个小小的目标" /></Field><div className="form-grid"><Field label="所属计划"><select name="planId" defaultValue={task?.planId ?? 'life'}>{state.plans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field><Field label="预计分钟"><input name="minutes" type="number" inputMode="numeric" min={1} max={1440} required defaultValue={task?.minutes ?? 20} /></Field></div><div className="form-grid"><Field label="开始日期"><input name="start" type="date" required defaultValue={task?.start ?? date} /></Field><Field label="重复周期"><select name="repeat" defaultValue={task?.repeat ?? 'none'}><option value="none">仅这一天</option><option value="daily">每天</option><option value="weekdays">周一至周五</option><option value="weekly">每周同一天</option></select></Field></div><Field label="备注"><textarea name="note" defaultValue={task?.note} maxLength={10000} placeholder="下一步做什么，写清楚就好。" /></Field><p className="hint">重复任务的修改从今天起生效。过去日期及已完成、已记时的任务保留原记录。</p><Submit />{task && <button type="button" className="button danger full" onClick={async () => { if (await change(st => deleteTask(st, task.id, today()), '已停止此任务，历史记录已保留')) close() }}><Trash2 size={16} />停止此任务（保留历史）</button>}</form>
}
export function ItemForm({ item, date, change, close }: { item: Item; date: string; change: Change; close: () => void }) {
  const [confirm, setConfirm] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const d = new FormData(e.currentTarget)
    if (await change(st => { const day = getDay(st, date); return { ...st, days: { ...st.days, [date]: { ...day, items: day.items.map(t => t.id === item.id ? { ...t, title: s(d, 'title'), minutes: n(d, 'minutes'), actual: n(d, 'actual'), context: s(d, 'context') as Item['context'], note: s(d, 'note') } : t) } } } }, '当天任务已保存')) close()
  }
  return <form className="form-stack" onSubmit={submit}><p className="hint">{date} · 仅修改本日任务。重复周期在「计划」中管理。</p><Field label="任务名称"><input name="title" required maxLength={200} defaultValue={item.title} /></Field><div className="form-grid"><Field label="预计分钟"><input name="minutes" type="number" min={1} max={1440} defaultValue={item.minutes} required inputMode="numeric" /></Field><Field label="实际学习分钟" help="未记录填 0；不随打卡自动计时"><input name="actual" type="number" min={0} max={date > today() ? 0 : 1440} defaultValue={item.actual} required inputMode="numeric" /></Field></div><Field label="学习场景" help="仅累加你输入的任务时长，课表时间不另计。课堂内学习请确保符合教师要求；实验、实习和体育须现场参与。"><select name="context" defaultValue={item.context}><option value="self">课外自主学习</option><option value="class">在对应理论课内学习（不重复计时）</option></select></Field><Field label="任务详情 / 备注"><textarea name="note" defaultValue={item.note} maxLength={10000} /></Field><Submit /><button type="button" className="button danger full" onClick={async () => { if (!confirm) return setConfirm(true); if (await change(st => { const day = getDay(st, date); return { ...st, days: { ...st.days, [date]: { ...day, items: day.items.map(t => t.id === item.id ? { ...t, removed: true } : t) } } } }, '已从本日清单移除，学习时长仍保留')) close() }}><Trash2 size={16} />{confirm ? '确认移除本日任务' : '移除本日任务'}</button></form>
}
export function ScoreForm({ record, date, change, close }: { record?: Score; date: string; change: Change; close: () => void }) {
  const [confirm, setConfirm] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const d = new FormData(e.currentTarget)
    const recordData: Score = { id: record?.id ?? uid(), date: s(d, 'date'), paper: s(d, 'paper'), listening: n(d, 'listening'), reading: n(d, 'reading'), writing: d.has('writing'), translation: d.has('translation'), note: s(d, 'note') }
    if (await change(st => ({ ...st, scores: [...st.scores.filter(x => x.id !== recordData.id), recordData] }), '真题记录已保存')) close()
  }
  return <form className="form-stack" onSubmit={submit}><Field label="测试日期"><input name="date" type="date" max={today()} defaultValue={record?.date ?? (date > today() ? today() : date)} required /></Field><Field label="真题年份与套次"><input name="paper" placeholder="例如：2025年6月 · 第1套" defaultValue={record?.paper} required maxLength={200} /></Field><div className="form-grid"><Field label="听力正确题数 / 25"><input type="number" name="listening" min={0} max={25} step={1} required defaultValue={record?.listening} inputMode="numeric" /></Field><Field label="阅读正确题数 / 30"><input type="number" name="reading" min={0} max={30} step={1} required defaultValue={record?.reading} inputMode="numeric" /></Field></div><label className="check-field"><input name="writing" type="checkbox" defaultChecked={record?.writing} />写作已完成</label><label className="check-field"><input name="translation" type="checkbox" defaultChecked={record?.translation} />翻译已完成</label><Field label="错题原因与备注"><textarea name="note" defaultValue={record?.note} placeholder="没听清、定位错误，还是同义替换？" maxLength={10000} /></Field><p className="hint">正确题数仅用于复盘，不换算或预测官方四级成绩。</p><Submit />{record && <button type="button" className="button danger full" onClick={async () => { if (!confirm) return setConfirm(true); if (await change(st => ({ ...st, scores: st.scores.filter(x => x.id !== record.id) }), '真题记录已删除')) close() }}>{confirm ? '确认删除这次记录' : '删除记录'}</button>}</form>
}
export function ProgressForm({ record, change, close }: { record?: Progress; change: Change; close: () => void }) {
  const [error, setError] = useState(''), [confirm, setConfirm] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const d = new FormData(e.currentTarget)
    if (n(d, 'completed') > n(d, 'total')) return setError('已完成集数不能大于总集数')
    const value: Progress = { id: record?.id ?? uid(), name: s(d, 'name'), chapter: s(d, 'chapter'), completed: n(d, 'completed'), total: n(d, 'total'), next: s(d, 'next'), note: s(d, 'note') }
    if (await change(st => ({ ...st, progress: [...st.progress.filter(x => x.id !== value.id), value] }), '网课进度已保存')) close()
  }
  return <form className="form-stack" onSubmit={submit}><Field label="课程名称"><input name="name" defaultValue={record?.name} required maxLength={200} placeholder="例如：信号与系统" /></Field><Field label="当前章节"><input name="chapter" defaultValue={record?.chapter} maxLength={500} placeholder="现在学到哪里了？" /></Field><div className="form-grid"><Field label="已完成集数"><input type="number" name="completed" min={0} max={100000} defaultValue={record?.completed ?? 0} required inputMode="numeric" /></Field><Field label="总集数"><input type="number" name="total" min={0} max={100000} defaultValue={record?.total ?? 0} required inputMode="numeric" /></Field></div><Field label="下一步任务"><textarea name="next" defaultValue={record?.next} maxLength={10000} /></Field><Field label="个人备注"><textarea name="note" defaultValue={record?.note} maxLength={10000} /></Field>{error && <p role="alert" className="error">{error}</p>}<Submit />{record && <button type="button" className="button danger full" onClick={async () => { if (!confirm) return setConfirm(true); if (await change(st => ({ ...st, progress: st.progress.filter(x => x.id !== record.id) }), '已移除网课进度')) close() }}>{confirm ? '确认删除此进度' : '删除进度'}</button>}</form>
}
export function CourseForm({ record, change, close }: { record?: Course; change: Change; close: () => void }) {
  const [error, setError] = useState(''), [confirm, setConfirm] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const d = new FormData(e.currentTarget), weeks: number[] = []
    for (const piece of s(d, 'weeks').split(/[,，、\s]+/).filter(Boolean)) {
      if (!/^\d+(?:[-–—]\d+)?$/.test(piece)) return setError('周次请用 1-4,7,9 这样的格式')
      const [a, b = a] = piece.split(/[-–—]/).map(Number)
      if (a < 1 || b > 53 || b < a) return setError('有效周次应在 1–53 之间')
      for (let w = a; w <= b; w++) weeks.push(w)
    }
    if (!weeks.length) return setError('请填写明确的有效周次')
    const value: Course = { id: record?.id ?? uid(), name: s(d, 'name'), day: n(d, 'day'), s: s(d, 's'), weeks: [...new Set(weeks)].sort((a, b) => a - b), type: s(d, 'type') as Course['type'], note: s(d, 'note') }
    if (value.day >= 0 && (!/^\d{1,2}[–\-—]\d{1,2}$/.test(value.s) || (() => { const [a, b] = value.s.split(/[–\-—]/).map(Number); return a < 1 || b < a || b > 20 })())) return setError('节次请填写如 1–2，且不超过第20节')
    if (await change(st => ({ ...st, courses: [...st.courses.filter(x => x.id !== value.id), value] }), '课程已保存')) close()
  }
  return <form className="form-stack" onSubmit={submit}><Field label="课程名称"><input name="name" required defaultValue={record?.name} maxLength={200} /></Field><div className="form-grid"><Field label="星期"><select name="day" defaultValue={record?.day ?? 0}>{['一', '二', '三', '四', '五', '六', '日'].map((d, i) => <option key={i} value={i}>周{d}</option>)}<option value={-1}>日期待通知</option></select></Field><Field label="第几节" help="未知可留空，不推测钟点"><input name="s" defaultValue={record?.s} placeholder="如 1–2" maxLength={50} /></Field></div><Field label="有效教学周" help="例如 2-5,7-10；单周请逐个列出"><input name="weeks" required defaultValue={record?.weeks.join(',')} maxLength={500} /></Field><Field label="类型"><select name="type" defaultValue={record?.type ?? 'theory'}><option value="theory">理论课</option><option value="digital">数字电子技术课</option><option value="lab">实验</option><option value="activity">体育 / 活动</option><option value="practice">实习</option></select></Field><Field label="附注 / 待核实说明"><textarea name="note" defaultValue={record?.note} maxLength={10000} /></Field>{error && <p className="error" role="alert">{error}</p>}<Submit />{record && <button type="button" className="button danger full" onClick={async () => { if (!confirm) return setConfirm(true); if (await change(st => ({ ...st, courses: st.courses.filter(x => x.id !== record.id) }), '课程已删除')) close() }}>{confirm ? '确认删除此课程' : '删除课程'}</button>}</form>
}
export function PlanForm({ plan, change, close }: { plan?: Plan; change: Change; close: () => void }) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const d = new FormData(e.currentTarget), value: Plan = { id: plan?.id ?? uid(), title: s(d, 'title'), tone: s(d, 'tone') as Tone }
    if (await change(st => ({ ...st, plans: [...st.plans.filter(x => x.id !== value.id), value] }), '计划已保存')) close()
  }
  return <form className="form-stack" onSubmit={submit}><Field label="计划名称"><input name="title" required defaultValue={plan?.title} maxLength={200} /></Field><Field label="卡片颜色"><select name="tone" defaultValue={plan?.tone ?? 'mint'}><option value="blue">雾蓝</option><option value="mint">薄荷</option><option value="lilac">淡紫</option><option value="peach">杏桃</option></select></Field><Submit /></form>
}
export function SettingsForm({ state, change, close }: { state: State; change: Change; close: () => void }) {
  const [error, setError] = useState('')
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const d = new FormData(e.currentTarget), semesterStart = s(d, 'semesterStart')
    if (semesterStart && weekday(semesterStart) !== 0) return setError('请填写第1教学周的周一日期')
    if (await change(st => ({ ...st, settings: { ...st.settings, semesterStart, examDate: s(d, 'examDate'), cetEnabled: d.has('cetEnabled') } }), '学习设置已保存')) close()
  }
  return <form className="form-stack" onSubmit={submit}><Field label="第1教学周的周一" help="导入个人课表后会自动填写；新学期可在这里修改。"><input name="semesterStart" type="date" defaultValue={state.settings.semesterStart} /></Field><Field label="下次四级目标日期"><input name="examDate" type="date" required defaultValue={state.settings.examDate} /></Field><label className="check-field"><input name="cetEnabled" type="checkbox" defaultChecked={state.settings.cetEnabled} />为新日期推荐四级任务</label><p className="hint">考试当天及之后不自动生成备考任务。调整设置会保留已保存的每日清单；未来日期尚未保存的清单按新设置生成。</p>{error && <p className="error" role="alert">{error}</p>}<Submit /></form>
}
// Used by the task list to describe recurrence without exposing implementation details.
export const repeatLabel = (task: Task) => ({ none: '仅一次', daily: '每天', weekdays: '工作日', weekly: '每周同一天' })[task.repeat]
export const activeTask = (task: Task) => !task.end || task.end >= today()
export const nextDate = (date: string) => addDays(date, 1)
