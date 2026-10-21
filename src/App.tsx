import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Coffee, FileCheck2, GraduationCap, Heart, House, Leaf, ListTodo, Moon, MoreHorizontal, Plus, Settings2, ShieldCheck, Sparkles, Sprout, Target, UserRound, WifiOff } from 'lucide-react'
import type { State, Task, Item, Course, Score, Progress, Plan } from './types'
import { addDays, changeMode, dateLabel, dayStats, diffDays, getDay, modes, monday, periodStats, route, streak, today, visibleItems, weekNumber, weekdays } from './domain'
import { readState, updateState } from './storage'
import { exportBackup, mergeImport, parseImport, type Imported } from './transfer'
import { activeTask, CourseForm, ItemForm, PlanForm, ProgressForm, repeatLabel, ScoreForm, SettingsForm, TaskForm, type Change } from './forms'
import { Brand, Empty, SectionTitle, Sheet, TaskCard } from './ui'

type Page = 'today' | 'plan' | 'calendar' | 'me'
type Modal = { kind: 'task'; record?: Task } | { kind: 'item'; record: Item } | { kind: 'course'; record?: Course } | { kind: 'score'; record?: Score } | { kind: 'progress'; record?: Progress } | { kind: 'plan'; record?: Plan } | { kind: 'settings' | 'install' | 'privacy' | 'legacy' | 'notes' }
const pageNames: Record<Page, string> = { today: '今日', plan: '计划', calendar: '日历', me: '我的' }
const download = (data: unknown, suffix = 'backup') => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = `studyflow-${suffix}-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000)
}
export default function App() {
  const [state, setState] = useState<State | null>(null), [error, setError] = useState(''), [saveError, setSaveError] = useState('')
  const [page, setPage] = useState<Page>(() => { const p = location.hash.slice(1).split('/')[0]; return Object.hasOwn(pageNames, p) ? p as Page : 'today' })
  const [date, setDate] = useState(today), [actualDate, setActualDate] = useState(today), [modal, setModal] = useState<Modal | null>(null)
  const [message, setMessage] = useState(''), [saving, setSaving] = useState(false), [online, setOnline] = useState(navigator.onLine)
  const [updateReady, setUpdateReady] = useState(false), [offlineReady, setOfflineReady] = useState(false), [pwaError, setPwaError] = useState('')
  const [imported, setImported] = useState<Imported | null>(null), [importError, setImportError] = useState('')
  const [planTab, setPlanTab] = useState(() => { const t = location.hash.split('/')[1]; return ['overview','courses','records'].includes(t) ? t : 'overview' }), [courseWeek, setCourseWeek] = useState(1), [courseDay, setCourseDay] = useState(0)
  const [month, setMonth] = useState(date.slice(0, 7) + '-01'), [importing, setImporting] = useState(false)
  const queue = useRef(Promise.resolve()), channel = useRef<BroadcastChannel | null>(null), updater = useRef<(reload?: boolean) => Promise<void>>(async () => {})
  const updateRequested = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const close = useCallback(() => setModal(null), [])
  const notify = useCallback((text: string) => setMessage(text), [])
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(''), 3200); return () => clearTimeout(t) }, [message])
  useEffect(() => {
    let live = true
    readState().then(s => { if (live) { setState(s); setCourseWeek(Math.max(1,Math.min(53,weekNumber(today(), s.settings.semesterStart) ?? 1))) } }).catch(e => { if (live) setError(String(e)) })
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel('studyflow-change')
      channel.current.onmessage = () => { void queue.current.then(() => readState().then(s => { if (live) setState(s) }).catch(() => {})) }
    }
    const hash = () => { const [p, t] = location.hash.slice(1).split('/'); if (Object.hasOwn(pageNames, p)) setPage(p as Page); if (p === 'plan' && ['overview','courses','records'].includes(t)) setPlanTab(t) }
    window.addEventListener('hashchange', hash)
    return () => { live = false; channel.current?.close(); window.removeEventListener('hashchange', hash) }
  }, [])
  useEffect(() => { if (page === 'plan') history.replaceState(null, '', '#plan/' + planTab) }, [page, planTab])
  const change: Change = useCallback((fn, text) => {
    setSaving(true); setSaveError('')
    const work = async () => {
      try {
        const run = async () => { const next = await updateState(fn); setState(next); channel.current?.postMessage('changed') }
        if (navigator.locks) await navigator.locks.request('studyflow-save', run); else await run()
        if (text) notify(text); return true
      } catch (e) { setSaveError(`未能保存：${e instanceof Error ? e.message : '设备存储不可用'}。请保留此页面并重试。`); return false }
    }
    const result = queue.current.then(work)
    queue.current = result.then(() => { setSaving(false) })
    return result
  }, [notify])
  useEffect(() => {
    const tick = () => { const d = today(); setActualDate(old => { if (old !== d) setDate(selected => selected === old ? d : selected); return d }) }
    const network = () => setOnline(navigator.onLine)
    const t = setInterval(tick, 30000); window.addEventListener('online', network); window.addEventListener('offline', network)
    return () => { clearInterval(t); window.removeEventListener('online', network); window.removeEventListener('offline', network) }
  }, [])
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => { const dark = state?.settings.theme === 'dark' || (state?.settings.theme !== 'light' && media.matches); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#191e1d' : '#F8F7F4') }
    apply(); media.addEventListener('change', apply); return () => media.removeEventListener('change', apply)
  }, [state?.settings.theme])
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    let registration: ServiceWorkerRegistration | undefined, wasControlled = Boolean(navigator.serviceWorker.controller)
    const observed = new WeakSet<ServiceWorkerRegistration>()
    const check = () => { if (navigator.onLine) registration?.update().catch(() => {}) }
    const observe = (reg?: ServiceWorkerRegistration) => {
      if (!reg) return
      registration = reg
      if (reg.active) setOfflineReady(true)
      if (reg.waiting) setUpdateReady(true)
      if (observed.has(reg)) return
      observed.add(reg)
      const observeWorker = () => {
        const worker = reg.installing
        const inspect = () => {
          if (worker?.state === 'installed' && navigator.serviceWorker.controller) setUpdateReady(true)
          if (worker?.state === 'activated') setOfflineReady(true)
        }
        worker?.addEventListener('statechange', () => {
          inspect()
        })
        inspect()
      }
      observeWorker(); reg.addEventListener('updatefound', observeWorker)
    }
    // Native lifecycle handling avoids a timing heuristic around closely spaced releases.
    void navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL).then(observe).catch(() => {})
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache:'none' }).then(observe).catch(() => { if (!registration?.active) setPwaError('离线缓存未就绪，请联网后重新打开一次。') })
    updater.current = async () => { const waiting = registration?.waiting; if (waiting) waiting.postMessage({ type:'SKIP_WAITING' }); else location.reload() }
    const controller = () => {
      setOfflineReady(true)
      if (updateRequested.current) location.reload()
      else if (wasControlled) setUpdateReady(true)
      wasControlled = true
    }
    const interval = setInterval(check, 3600000)
    navigator.serviceWorker.addEventListener('controllerchange', controller)
    document.addEventListener('visibilitychange', check)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', check); navigator.serviceWorker.removeEventListener('controllerchange', controller) }
  }, [])
  // Preserve the first view of a day's plan. Later template changes cannot rewrite history.
  useEffect(() => {
    if (state && page === 'today' && !state.days[date]) void change(s => s.days[date] ? s : ({ ...s, days: { ...s.days, [date]: getDay(s, date) } }))
  }, [date, page, state, change])
  function navigate(p: Page) { setPage(p); location.hash = p; window.scrollTo({ top: 0, behavior: 'instant' }) }
  function openCourses() { if (state) setCourseWeek(Math.max(1, Math.min(53, weekNumber(date, state.settings.semesterStart) ?? 1))); setCourseDay((new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7); setPlanTab('courses'); navigate('plan') }
  function patchDay(fn: (d: ReturnType<typeof getDay>) => ReturnType<typeof getDay>, text?: string) { return change(s => ({ ...s, days: { ...s.days, [date]: fn(getDay(s, date)) } }), text) }
  function toggle(item: Item) {
    if (date > actualDate) return notify('未来的日子先安排，到那天再打卡。')
    void patchDay(d => ({ ...d, items: d.items.map(t => t.id === item.id ? { ...t, done: !t.done } : t) }), item.done ? '已取消完成，按自己的节奏来。' : '又完成一小步，真好。')
  }
  async function loadFile(file?: File) {
    setImportError(''); if (!file) return
    if (file.size > 10 * 1024 * 1024) return setImportError('请选择小于10MB的JSON文件')
    try { setImported(parseImport(await file.text())) } catch (e) { setImportError(e instanceof Error ? e.message : '文件无法读取') }
  }
  async function confirmImport(replace: boolean) {
    if (!state || !imported || importing) return
    setImporting(true)
    if (replace && imported.kind !== 'schedule') download(exportBackup(state), 'before-restore-backup')
    if (await change(s => mergeImport(s, imported, replace), '导入完成，数据已保存到本机')) { setImported(null); setCourseWeek(Math.max(1,Math.min(53,weekNumber(today(), imported.state.settings.semesterStart) ?? 1))) }
    setImporting(false)
  }
  if (error) return <main className="app error-screen"><Brand /><h1>暂时无法打开本机数据</h1><p>{error}</p><p>现有数据没有被覆盖。请确认浏览器允许网站存储，并关闭其他拾光窗口后重试。</p><button className="button primary" onClick={() => location.reload()}>重新打开</button></main>
  if (!state) return <main className="app loading"><Brand /><Sprout size={36} /><p>给今天留一点空间…</p></main>
  const day = getDay(state, date), items = visibleItems(day), stats = dayStats(day), percent = stats.total ? Math.round(stats.done / stats.total * 100) : 0
  const teachingWeek = weekNumber(date, state.settings.semesterStart)
  const dayOfWeek = (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7
  const courses = state.courses.filter(c => c.day === dayOfWeek && teachingWeek && c.weeks.includes(teachingWeek)).sort((a, b) => parseInt(a.s) - parseInt(b.s))
  const weekTip = state.weekPlan.find(w => w.week === teachingWeek)
  const diff = diffDays(state.settings.examDate, actualDate)
  const selectDate = (d: string) => { setDate(d); setMonth(d.slice(0, 7) + '-01') }
  const renderCourse = (c: Course) => <button key={c.id} className="course-row" onClick={() => setModal({ kind: 'course', record: c })}><span className={`course-period tone-${c.type === 'lab' || c.type === 'practice' ? 'peach' : c.type === 'digital' ? 'mint' : 'lilac'}`}>{c.day < 0 ? '待通知' : <><b>{c.s}</b><small>节</small></>}</span><span className="course-copy"><strong>{c.name}</strong><small>{c.note ? `待核实 · ${c.note}` : c.type === 'lab' || c.type === 'activity' || c.type === 'practice' ? '按安排现场参加 · 不计为自习时段' : '课堂按教师要求参与'}</small></span><ChevronRight size={15} /></button>

  let content: ReactNode
  if (page === 'today') content = <>
    <header className="home-header"><div><p className="eyebrow">{date === actualDate ? '把日子过成喜欢的样子' : '每一天，都值得被记住'}</p><h1>{date === actualDate ? '今天，也慢慢来' : dateLabel(date)}<span className="tiny-spark">✧</span></h1><p className="date-sub">{dateLabel(date)} · 星期{weekdays[dayOfWeek]}<span className="dot-separator">·</span>{teachingWeek ? `第 ${teachingWeek} 教学周` : '你的学习日常'}</p></div><button className="avatar-button" aria-label="打开我的" onClick={() => navigate('me')}><Sprout size={27} strokeWidth={1.5} /></button></header>
    <div className="week-head"><button className="text-button" onClick={() => selectDate(addDays(date, -7))}><ChevronLeft size={15} />上一周</button><button className="text-button" onClick={() => selectDate(actualDate)}>回到今天</button><button className="text-button" onClick={() => selectDate(addDays(date, 7))}>下一周<ChevronRight size={15} /></button></div>
    <div className="week-strip" aria-label="七日日期导航">{Array.from({ length: 7 }, (_, i) => { const d = addDays(monday(date), i), st = dayStats(state.days[d]); return <button key={d} className={`week-day ${d === date ? 'selected' : ''} ${d === actualDate ? 'is-today' : ''}`} aria-label={d} aria-pressed={d === date} onClick={() => selectDate(d)}><span>{weekdays[i]}</span><b>{Number(d.slice(8))}</b><i className={st.done ? 'has-record' : ''} /></button> })}</div>
    <section className="daily-progress"><div><span className="overline">一点一滴，都在积累</span><h2>{stats.done === stats.total && stats.total ? '今天的努力，已收好' : stats.done ? '正在靠近更好的自己' : '从一件小事开始吧'}</h2><p>已完成 <strong>{stats.done}</strong> / {stats.total} 项<span>不赶路，感受路。</span></p></div><div className="progress-ring" role="img" aria-label={`完成进度 ${percent}%`}><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="33" /><circle cx="40" cy="40" r="33" strokeDasharray={`${percent * 2.073} 207.3`} /></svg><b>{percent}<small>%</small></b></div><span className="progress-decoration" /></section>
    <SectionTitle title={date === actualDate ? '今日要做' : '这一天的清单'} extra={<button className="text-button accent" onClick={() => setModal({ kind: 'task' })}><Plus size={17} />添加</button>} />
    <div className="task-list">{items.length ? items.map(item => <TaskCard key={item.id} item={item} state={state} toggle={() => toggle(item)} detail={() => setModal({ kind: 'item', record: item })} />) : <Empty title="留一点空白，也很好" text="添一件想做的小事，今天就从这里开始。" action="添加任务" onAction={() => setModal({ kind: 'task' })} />}</div>
    {state.settings.cetEnabled && date < state.settings.examDate && <div className="flex-mode"><span><Coffee size={15} />今天的英语节奏</span><div className="mode-options" aria-label="英语学习时长">{modes.map(m => <button key={m} className={day.mode === m ? 'selected' : ''} aria-pressed={day.mode === m} onClick={() => void patchDay(d => changeMode(d, m), '英语节奏已调整，已完成和已记时任务保留。')}>{m}<small>分</small></button>)}</div><p>忙碌时，30 分钟也很棒。已完成的努力会留下。</p></div>}
    {state.settings.cetEnabled && <button className="exam-card" onClick={() => { setPlanTab('overview'); navigate('plan') }}><span className="exam-icon"><BookOpen size={23} strokeWidth={1.5} /></span><span><span className="overline">英语四级 · 给未来的自己</span><strong>{diff > 0 ? '一点点准备，一步步靠近' : diff === 0 ? '今天考试，愿你从容落笔' : '这一程结束，新的日常继续'}</strong><small>{state.settings.examDate.replaceAll('-', '.')} {state.settings.examDate === '2026-12-12' ? ' · 09:00–11:20' : ''}</small></span>{diff > 0 ? <span className="countdown"><b>{diff}</b><small>天</small></span> : <ChevronRight size={20} />}</button>}
    <SectionTitle title="今日课程" extra={<button className="text-button" onClick={openCourses}>查看课表<ChevronRight size={14} /></button>} />
    <section className="card course-card">{state.courses.length ? courses.length ? courses.map(renderCourse) : <div className="quiet-empty"><Leaf size={20} /><p>主表没有固定课程，仍请留意实验与实习通知。</p></div> : <div className="import-inline"><span className="tone-lilac symbol"><GraduationCap size={24} /></span><div><strong>把你的课表，装进口袋</strong><p>由你导入，只留在这台设备。</p></div><button className="icon-button" aria-label="导入个人课表" onClick={() => input.current?.click()}><Plus size={19} /></button></div>}{state.uncertainNotes.length > 0 && <details className="uncertain"><summary>待通知 / 待核实 · {state.uncertainNotes.length} 条</summary>{state.uncertainNotes.map((n, i) => <p key={i}>{n}</p>)}</details>}</section>
    {weekTip && <section className="week-tip"><Sparkles size={17} /><div><strong>本周 · {weekTip.name}</strong><p>{weekTip.desc}</p></div></section>}
    <div className="encouragement"><Heart size={14} /><span>允许自己慢一点，每一小步都算数。</span></div>
    <section className="card note-card"><div className="section-title"><h2>留一句给今天</h2><span className="muted">自动保存</span></div><DayNote key={date} value={day.note} save={value => { void patchDay(d => ({ ...d, note: value })) }} /><div className="note-footer"><Leaf size={13} /><span>今天的心情、灵感，或一个小小的收获。</span></div></section>
  </>
  else if (page === 'plan') content = <>
    <PageHeading eyebrow="给想做的事，留好位置" title="慢慢生长的计划" icon={<Sprout size={30} strokeWidth={1.4} />} />
    <div className="segmented">{[['overview', '学习计划'], ['courses', '我的课表'], ['records', '真题记录']].map(([id, name]) => <button key={id} className={planTab === id ? 'active' : ''} onClick={() => setPlanTab(id)}>{name}</button>)}</div>
    {planTab === 'overview' && <>
      <SectionTitle title="我的小计划" extra={<button className="text-button accent" onClick={() => setModal({ kind: 'plan' })}><Plus size={16} />新计划</button>} />
      <div className="plan-cards">{state.plans.map(p => <section className={`plan-card tone-${p.tone}`} key={p.id}><button className="plan-card-heading" onClick={() => setModal({ kind: 'plan', record: p })}><span><BookOpen size={18} /><b>{p.title}</b></span><MoreHorizontal size={20} /></button><p>{state.tasks.filter(t => activeTask(t) && t.planId === p.id).length} 个自定任务{p.id === 'cet' && state.settings.cetEnabled ? ' · 每日弹性练习' : ''}</p><div className="plan-task-list">{state.tasks.filter(t => activeTask(t) && t.planId === p.id).map(t => <button key={t.id} onClick={() => setModal({ kind: 'task', record: t })}><span>{t.title}<small>{repeatLabel(t)} · {t.minutes} 分钟</small></span><ChevronRight size={15} /></button>)}</div></section>)}</div>
      <button className="button secondary full" onClick={() => setModal({ kind: 'task' })}><Plus size={17} />添加自由任务</button>
      <SectionTitle title="专业课 · 网课进度" extra={<button className="text-button" onClick={() => setModal({ kind: 'progress' })}><Plus size={16} />添加</button>} />
      {state.progress.length ? state.progress.map(p => <button className="card progress-card" key={p.id} onClick={() => setModal({ kind: 'progress', record: p })}><div className="row"><strong>{p.name}</strong><span>{p.completed} / {p.total || '待填'} 集<ChevronRight size={14} /></span></div><p>{p.chapter || '填写当前章节，让下一步更清晰。'}</p><div className="linear-progress"><span style={{ width: p.total ? `${p.completed / p.total * 100}%` : '0%' }} /></div><small>{p.next ? `下一步 · ${p.next}` : '还没有下一步任务'}</small></button>) : <div className="card"><Empty icon={GraduationCap} title="从当前章节开始" text="记录网课进度，把大目标拆成下一小步。" action="添加网课" onAction={() => setModal({ kind: 'progress' })} /></div>}
      <details className="card route-card" open><summary><Target size={18} /><strong>四级 · 这一程怎么走</strong><ChevronRight size={16} /></summary><p className="hint">2026.10.21 — 12.12 · 听力和阅读优先，按实际课业调整，不追赶欠账。</p><div className="route-list">{route.map(([start, end, title, desc], i) => <div className={`route-step ${actualDate >= start && actualDate <= end ? 'current' : ''}`} key={start}><span>{String(i + 1).padStart(2, '0')}</span><div><small>{start.slice(5).replace('-', '.')} — {end.slice(5).replace('-', '.')}</small><h3>{title}</h3><p>{desc}</p></div></div>)}</div></details>
      <button className="button text full" onClick={() => setModal({ kind: 'settings' })}><Settings2 size={17} />调整目标日期与学习设置</button>
    </>}
    {planTab === 'courses' && <>
      <div className="card course-select"><div className="row"><h2>按教学周次看课表</h2><select aria-label="教学周次" value={courseWeek} onChange={e => setCourseWeek(+e.target.value)}>{Array.from({ length: 53 }, (_, i) => <option key={i} value={i + 1}>第 {i + 1} 周</option>)}</select></div><p className="hint">{state.settings.semesterStart ? `第1周从 ${state.settings.semesterStart} 开始` : '先导入课表，或在学习设置中填写学期起点'} · 节次不换算钟点</p><div className="day-picker">{weekdays.map((d, i) => <button key={d} className={courseDay === i ? 'active' : ''} onClick={() => setCourseDay(i)} aria-label={`课表周${d}`} aria-pressed={courseDay === i}>周{d}</button>)}</div></div>
      <SectionTitle title={`第 ${courseWeek} 周 · 周${weekdays[courseDay]}`} extra={<button className="text-button accent" onClick={() => setModal({ kind: 'course' })}><Plus size={16} />课程</button>} />
      <div className="card course-card">{state.courses.filter(c => c.day === courseDay && c.weeks.includes(courseWeek)).sort((a, b) => parseInt(a.s) - parseInt(b.s)).map(renderCourse)}{!state.courses.some(c => c.day === courseDay && c.weeks.includes(courseWeek)) && <Empty icon={Coffee} title="主表没有固定课程" text="没有列出的实验与实习，请继续关注教师通知。" />}{state.courses.filter(c => c.day === -1 && c.weeks.includes(courseWeek)).map(renderCourse)}</div>
      <section className="card notice-card"><SectionTitle title="待通知与待核实" extra={<button className="text-button" onClick={() => setModal({ kind: 'notes' })}>编辑</button>} />{state.uncertainNotes.length ? state.uncertainNotes.map((x, i) => <p key={i}>{x}</p>) : <p>没有额外提醒。未知的日期或节次可添加为「日期待通知」课程。</p>}<small>实验、实习和体育按学校要求参与；主表与附注有矛盾时保留提示。</small></section>
      <details className="card all-courses"><summary>全部课程 · 管理有效周次</summary>{state.courses.map(c => <button key={c.id} className="manage-row" onClick={() => setModal({ kind: 'course', record: c })}><span>{c.name}<small>{c.day < 0 ? '日期待通知' : `周${weekdays[c.day]} · 第${c.s}节`} · 周次 {c.weeks.join('、')}</small></span><ChevronRight size={16} /></button>)}</details>
      <div className="button-pair"><button className="button secondary" onClick={() => input.current?.click()}><ArrowUpFromLine size={16} />导入课表</button><button className="button secondary" onClick={() => setModal({ kind: 'settings' })}><Settings2 size={16} />学期设置</button></div>
    </>}
    {planTab === 'records' && <><section className="record-intro tone-blue"><FileCheck2 size={30} strokeWidth={1.4} /><h2>把练习变成经验</h2><p>只记录真实作答，留意听力与阅读的变化。<br />这里不预测官方成绩。</p><button className="button primary" onClick={() => setModal({ kind: 'score' })}><Plus size={17} />记录一次真题</button></section>{state.scores.length ? [...state.scores].sort((a, b) => b.date.localeCompare(a.date)).map(r => <button className="card score-card" key={r.id} onClick={() => setModal({ kind: 'score', record: r })}><div className="row"><small>{r.date}</small><MoreHorizontal size={20} /></div><h3>{r.paper}</h3><div className="score-values"><span>听力 <b>{r.listening}</b><small>/ 25</small></span><span>阅读 <b>{r.reading}</b><small>/ 30</small></span></div><p>写作{r.writing ? '已完成' : '未完成'} · 翻译{r.translation ? '已完成' : '未完成'}</p>{r.note && <p className="clamp">{r.note}</p>}</button>) : <Empty icon={BookOpen} title="第一份记录，从现在开始" text="做一套真题，认识自己的起点。" />}</>}
  </>
  else if (page === 'calendar') {
    const first = month, offset = (new Date(first + 'T12:00:00Z').getUTCDay() + 6) % 7
    const monthShift = (amount: number) => { const d = new Date(month + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + amount); setMonth(d.toISOString().slice(0, 10)) }
    const weekDates = Array.from({ length: 7 }, (_, i) => addDays(actualDate, i - 6)), values = weekDates.map(d => dayStats(state.days[d]))
    const totals = values.reduce((a, b) => ({ done: a.done + b.done, total: a.total + b.total, actual: a.actual + b.actual }), { done: 0, total: 0, actual: 0 })
    const selectedStats = dayStats(state.days[date]), selectedItems = state.days[date]?.items ?? []
    const weekEnd = addDays(monday(date),6), weekTotals = periodStats(state,monday(date),weekEnd > actualDate ? actualDate : weekEnd)
    content = <><PageHeading eyebrow="每一点努力，都有回响" title="日子留下的光" icon={<CalendarDays size={29} strokeWidth={1.4} />} /><section className="card calendar-card"><div className="row month-title"><button className="icon-button" aria-label="上个月" onClick={() => monthShift(-1)}><ChevronLeft size={20} /></button><h2>{Number(month.slice(0, 4))}年 <b>{Number(month.slice(5, 7))}</b> 月</h2><button className="icon-button" aria-label="下个月" onClick={() => monthShift(1)}><ChevronRight size={20} /></button></div><div className="calendar-grid">{weekdays.map(w => <span className="calendar-weekday" key={w}>{w}</span>)}{Array.from({ length: 42 }, (_, i) => { const d = addDays(first, i - offset), st = dayStats(state.days[d]), inMonth = d.slice(0, 7) === month.slice(0, 7), done = st.total > 0 && st.done === st.total; return <button className={`calendar-cell ${inMonth ? '' : 'outside'} ${date === d ? 'selected' : ''} ${done ? 'complete' : st.done > 0 ? 'partial' : ''} ${d === actualDate ? 'today' : ''}`} aria-label={`${d}${done ? ' 全部完成' : st.done ? ' 部分完成' : ' 未打卡'}`} aria-pressed={date === d} key={d} onClick={() => setDate(d)}><b>{Number(d.slice(8))}</b><i /></button> })}</div><div className="calendar-legend"><span><i className="full-dot" />全部完成</span><span><i className="part-dot" />部分完成</span><span><i />没有打卡</span></div></section><SectionTitle title="最近 7 天" extra={<span className="muted">{dateLabel(weekDates[0])} — {dateLabel(actualDate)}</span>} /><section className="card stats-card"><div className="stats-summary"><div><b>{totals.actual}<small>分钟</small></b><span>实际记录学习</span></div><div><b>{totals.total ? Math.round(totals.done / totals.total * 100) : 0}<small>%</small></b><span>清单完成率</span></div><div><b>{streak(state, actualDate)}<small>天</small></b><span>最近连续打卡</span></div></div><div className="week-chart" aria-label="最近七天任务完成情况">{weekDates.map((d, i) => <div key={d}><span className="chart-value">{values[i].done || '—'}</span><div className="bar-bg"><span style={{ height: values[i].total ? `${values[i].done / values[i].total * 100}%` : '0%' }} /></div><small>{weekdays[(new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7]}</small></div>)}</div><div className="week-completion"><div><strong>选中周 · 完成率</strong><small>{dateLabel(monday(date))} — {dateLabel(weekEnd)}</small></div><b>{weekTotals.total ? Math.round(weekTotals.done / weekTotals.total * 100) : 0}<small>%</small></b></div><p className="hint">只统计已保存的清单与手动填写的实际时长。课堂不另计时；没有记录的日期显示为空。偶尔停一停，也没关系。</p></section><SectionTitle title={`${dateLabel(date)}的小收获`} extra={<button className="text-button accent" onClick={() => navigate('today')}>查看当天<ChevronRight size={14} /></button>} /><section className="card history-card"><p className="history-summary">完成 {selectedStats.done} / {selectedStats.total} 项 · 实际 {selectedStats.actual} 分钟</p>{selectedItems.length ? selectedItems.map(t => <div className={`history-row ${t.removed ? 'removed' : ''}`} key={t.id}><span className={t.done ? 'done' : ''}>{t.done ? <Check size={15} /> : <span className="history-circle" />}</span><div><strong>{t.title}{t.removed ? '（已移除）' : ''}</strong><small>{t.actual ? `实际 ${t.actual} 分钟` : '未记录实际时长'}</small></div></div>) : <Empty icon={Leaf} title="这一天还没有记录" text="空白也是日常的一部分。" />}{state.days[date]?.note && <blockquote>{state.days[date].note}</blockquote>}</section></>
  }
  else content = <>
    <PageHeading eyebrow="让学习，更像自己的生活" title="我的小空间" icon={<UserRound size={29} strokeWidth={1.4} />} /><section className="profile-card"><div className="profile-mark"><Sprout size={37} strokeWidth={1.4} /></div><h2>拾光的每一天</h2><p>不必完美，慢慢积累。</p><span><ShieldCheck size={13} />{saving ? '正在保存…' : saveError ? '保存需要重试' : '仅在本机 · 已保存'}</span></section>
    <SectionTitle title="舒服的样子" /><section className="card preference-card"><span><Moon size={18} />外观模式</span><div className="theme-options">{([['system', '自动'], ['light', '浅色'], ['dark', '深色']] as const).map(([id, title]) => <button className={state.settings.theme === id ? 'active' : ''} key={id} onClick={() => void change(st => ({ ...st, settings: { ...st.settings, theme: id } }))}>{title}</button>)}</div></section>
    <section className="card menu-card"><MenuRow icon={<Settings2 size={19} />} title="学习与学期设置" subtitle="目标日期、教学周次与英语任务" onClick={() => setModal({ kind: 'settings' })} /><MenuRow icon={<ArrowUpFromLine size={19} />} title="导入课表 / 恢复备份" subtitle="先预览，再保存到本机" onClick={() => input.current?.click()} /><MenuRow icon={<ArrowDownToLine size={19} />} title="导出 JSON 备份" subtitle="任务、课表、真题与全部打卡记录" onClick={() => { download(exportBackup(state)); notify('备份已生成，请在下载文件中妥善保存。') }} /><MenuRow icon={<Clock3 size={19} />} title="从旧版迁移记录" subtitle="不同网址无法直接读取旧存储" onClick={() => setModal({ kind: 'legacy' })} /></section>
    <SectionTitle title="安心使用" /><section className="card menu-card"><MenuRow icon={<Plus size={19} />} title="添加到 iPhone 主屏幕" subtitle="像 App 一样打开拾光" onClick={() => setModal({ kind: 'install' })} /><MenuRow icon={<ShieldCheck size={19} />} title="数据与隐私" subtitle="无需账号，不上传个人学习记录" onClick={() => setModal({ kind: 'privacy' })} /><MenuRow icon={<WifiOff size={19} />} title={offlineReady ? '离线已就绪' : online ? '离线缓存状态' : '当前离线'} subtitle={pwaError || (offlineReady ? '断网后可打开，学习记录保存在设备' : '正式构建首次联网打开后缓存应用')} onClick={() => { setModal({ kind: 'install' }) }} /></section>
    <div className="about"><Brand small /><p>给学习留一点温柔。</p><small>版本 1.0.0 · 本地优先的学习日常</small><p className="hint">建议每周导出一次备份。清理网站数据、更换设备或更换网址前，请先备份。</p></div>
  </>
  return <><div className="app"><div className="app-top"><Brand small /><span className={`connection ${online ? '' : 'offline'}`}>{!online && <WifiOff size={12} />}{saving ? '保存中' : !online ? '离线可用' : '一点一滴，拾起时光'}</span></div>{saveError && <div role="alert" className="alert-error">{saveError}<button className="text-button" onClick={() => location.reload()}>重新读取</button></div>}{pwaError && <p className="hint">{pwaError}</p>}{updateReady && <div className="update-banner"><span><Sparkles size={16} />有新版本，记录会保留</span><button className="button primary compact" disabled={saving} onClick={async () => { await queue.current; updateRequested.current = true; await updater.current(true) }}>更新</button><button className="icon-button" aria-label="稍后更新" onClick={() => setUpdateReady(false)}>×</button></div>}{content}<footer className="page-footer"><span>慢慢来，你一直在生长</span><Leaf size={13} /></footer></div>
    <nav className="bottom-nav" aria-label="主导航">{([['today', House], ['plan', ListTodo], ['calendar', CalendarDays], ['me', UserRound]] as const).map(([id, Icon]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)} aria-current={page === id ? 'page' : undefined}><span><Icon size={22} strokeWidth={page === id ? 2 : 1.7} /></span><small>{pageNames[id]}</small></button>)}</nav>
    <input ref={input} type="file" accept="application/json,.json" className="visually-hidden" aria-label="选择JSON文件" onChange={e => { void loadFile(e.target.files?.[0]); e.currentTarget.value = '' }} />
    {message && <div className="toast" role="status"><Check size={16} />{message}</div>}
    {importError && <Sheet title="文件暂时无法导入" close={() => setImportError('')}><div className="prose"><p className="error" role="alert">{importError}</p><p>原有数据保持不变。请选择拾光备份、个人课表 JSON 或旧版导出文件。</p></div></Sheet>}
    {imported && <Sheet title="确认导入内容" close={() => { if (!importing) setImported(null) }}><div className="prose"><span className="label-pill">{imported.kind === 'schedule' ? '个人课表' : imported.kind === 'legacy' ? '旧版迁移' : '完整备份'}</span><h3>{imported.summary}</h3><p>文件已经通过格式校验。导入只写入当前设备，不会上传至服务器。</p><p>合并导入按ID去重；遇到相同记录时，保留本机内容。重复导入不会增加副本。</p>{imported.kind === 'schedule' ? <p>替换课表只更新课程表和学期设置，学习记录会保留。</p> : <p>替换恢复会覆盖本机数据，并先下载一份当前数据备份，请保留下载文件。</p>}<div className="form-stack"><button className="button primary full" disabled={importing} onClick={() => void confirmImport(false)}>合并导入 · 保留本机冲突项</button><button className="button secondary full" disabled={importing} onClick={() => void confirmImport(true)}>{imported.kind === 'schedule' ? '替换当前课表' : '替换恢复全部数据'}</button><button className="button text full" disabled={importing} onClick={() => setImported(null)}>取消</button></div></div></Sheet>}
    {modal && <Sheet title={{ task: modal.kind === 'task' && modal.record ? '编辑重复任务' : '添一件小事', item: '任务详情', course: '课程安排', score: '真题练习记录', progress: '网课进度', plan: '我的学习计划', settings: '学习与学期设置', install: '把拾光放在主屏幕', privacy: '你的记录，只属于你', legacy: '带上过去的小努力', notes: '待通知与待核实' }[modal.kind]} close={close}>
      {modal.kind === 'task' && <TaskForm state={state} date={date} task={modal.record} change={change} close={close} />}
      {modal.kind === 'item' && <ItemForm date={date} item={modal.record} change={change} close={close} />}
      {modal.kind === 'course' && <CourseForm record={modal.record} change={change} close={close} />}
      {modal.kind === 'score' && <ScoreForm record={modal.record} date={date} change={change} close={close} />}
      {modal.kind === 'progress' && <ProgressForm record={modal.record} change={change} close={close} />}
      {modal.kind === 'plan' && <PlanForm plan={modal.record} change={change} close={close} />}
      {modal.kind === 'settings' && <SettingsForm state={state} change={change} close={close} />}
      {modal.kind === 'notes' && <form className="form-stack" onSubmit={async e => { e.preventDefault(); const text = String(new FormData(e.currentTarget).get('notes')); if (await change(st => ({ ...st, uncertainNotes: text.split('\n').map(x => x.trim()).filter(Boolean) }), '提醒已保存')) close() }}><label className="field"><span>每行一条提醒，保留来源中的冲突</span><textarea name="notes" defaultValue={state.uncertainNotes.join('\n')} maxLength={10000} rows={7} /></label><button className="button primary" type="submit">保存提醒</button></form>}
      {modal.kind === 'install' && <div className="prose"><div className="install-art"><img src={`${import.meta.env.BASE_URL}icons/apple-touch-icon.png`} width="80" height="80" alt="拾光图标" /><span>拾光 · StudyFlow</span></div><ol><li>用 iPhone 的 <strong>Safari</strong> 打开正式网站。</li><li>点底部或菜单里的<strong>分享</strong>按钮。</li><li>选择<strong>添加到主屏幕</strong>，如出现选项，请开启「作为网页 App 打开」。</li><li>从主屏幕图标打开，首次联网等待离线缓存完成。</li></ol><p>已缓存的应用支持断网使用。主屏幕窗口与浏览器的存储行为可能不同，首次安装后检查记录，必要时用 JSON 备份恢复。</p><p className="hint">离线缓存与本机学习数据分别保存。更新只替换应用文件，不会清空学习记录。系统仍可能清理网站存储，请定期备份。</p></div>}
      {modal.kind === 'privacy' && <div className="prose"><ShieldCheck className="privacy-icon" size={38} strokeWidth={1.3} /><h3>不需要账号，也没有云同步</h3><p>课表、任务、真题、备注和打卡保存在此设备的 IndexedDB 中。应用没有数据上传接口、第三方字体或追踪统计。</p><p>网站托管方仍会接收访问网站所需的基础网络请求。你的课表和学习备份不会随请求发送。</p><a href={`${import.meta.env.BASE_URL}THIRD_PARTY_NOTICES.txt`} target="_blank" rel="noreferrer">查看开源依赖许可证</a><h3>一份备份，多一点安心</h3><p>清理浏览器数据、更换设备或网址后，本机数据可能无法访问。建议每周在「我的」导出 JSON，保存到你信任的位置。</p><p>备份包含个人日程和学习记录，请勿提交至公开仓库或分享给无关人员。导入文件只在本机解析。</p><h3>记录的含义</h3><p>打卡表示你完成了任务，不自动等于学习了预计分钟数。实际时长由你在任务详情填写，课表不另行累计。统计仅基于真实保存的数据。</p></div>}
      {modal.kind === 'legacy' && <div className="prose"><h3>旧版记录不会自动跨网址移动</h3><p>如果旧页面中有打卡，请在仍能看到记录的原浏览器、原网址中导出。新网站无法读取另一个来源的 localStorage。</p><ol><li>在电脑打开原来的旧网页，确认记录存在。</li><li>打开下方迁移脚本，将内容复制到旧网页的开发者工具 Console 中运行。</li><li>保存下载的 JSON，再在拾光「导入课表 / 恢复备份」中选择它。</li></ol><a className="button secondary full" href={`${import.meta.env.BASE_URL}legacy-exporter.txt`} target="_blank" rel="noreferrer"><ArrowDownToLine size={16} />打开旧版导出脚本</a><p>脚本只读取 cet26_ 前缀，不清除旧记录。导入会合并各英语档位已勾选项；旧版没有实际时长、试卷套次和写译记录，这些字段保持未记录。</p><p className="hint">如果原浏览器已清除数据，或旧页面从未保存成功，无法凭空恢复。请继续保留旧页面和旧导出文件。</p></div>}
    </Sheet>}
  </>
}
function PageHeading({ eyebrow, title, icon }: { eyebrow: string; title: string; icon: ReactNode }) { return <header className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div><span>{icon}</span></header> }
function MenuRow({ icon, title, subtitle, onClick }: { icon: ReactNode; title: string; subtitle: string; onClick: () => void }) { return <button className="menu-row" onClick={onClick}><span className="menu-icon">{icon}</span><span><strong>{title}</strong><small>{subtitle}</small></span><ChevronRight size={16} /></button> }
function DayNote({ value, save }: { value: string; save: (value: string) => void }) {
  const [draft, setDraft] = useState(value), latestSave = useRef(save), saved = useRef(value)
  latestSave.current = save
  useEffect(() => { setDraft(value); saved.current = value }, [value])
  useEffect(() => { if (draft === saved.current) return; const t = setTimeout(() => { saved.current = draft; latestSave.current(draft) }, 500); return () => clearTimeout(t) }, [draft])
  return <textarea aria-label="今日备注" placeholder="今天，有什么值得记住的小事？" value={draft} maxLength={10000} onChange={e => setDraft(e.target.value)} onBlur={() => { if (saved.current !== draft) { saved.current = draft; latestSave.current(draft) } }} />
}
