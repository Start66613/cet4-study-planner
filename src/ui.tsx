import { useEffect, useRef, type ReactNode } from 'react'
import { X, Plus, BookOpen, Headphones, PenLine, RotateCcw, Sprout, GraduationCap, Sun, Check, type LucideIcon } from 'lucide-react'
import type { Item, State } from './types'
export function Sheet({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const d = ref.current!; d.showModal(); const cancel = (e: Event) => { e.preventDefault(); close() }; d.addEventListener('cancel', cancel); return () => { d.removeEventListener('cancel', cancel); d.close() } }, [close])
  return <dialog ref={ref} className="sheet" onClick={e => { if (e.target === e.currentTarget) close() }}><div className="sheet-body"><div className="sheet-grip" /><div className="sheet-heading"><h2>{title}</h2><button className="icon-button" aria-label="关闭" onClick={close}><X size={20} /></button></div>{children}</div></dialog>
}
export function Empty({ icon: Icon = Sprout, title, text, action, onAction }: { icon?: LucideIcon; title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="empty"><span className="empty-icon"><Icon size={27} strokeWidth={1.5} /></span><h3>{title}</h3><p>{text}</p>{action && <button className="button secondary" onClick={onAction}><Plus size={16} />{action}</button>}</div>
}
export function TaskCard({ item, state, toggle, detail }: { item: Item; state: State; toggle: () => void; detail: () => void }) {
  const plan = state.plans.find(p => p.id === item.planId), tone = plan?.tone ?? 'peach'
  const Icon = ({ words: BookOpen, listen: Headphones, read: BookOpen, review: RotateCcw, write: PenLine } as Record<string, LucideIcon>)[item.cet ?? ''] ?? (item.planId === 'major' ? GraduationCap : Sprout)
  return <article className={`task-card ${item.done ? 'is-done' : ''}`}>
    <button className={`task-symbol tone-${tone}`} aria-label={`查看${item.title}`} onClick={detail}><Icon size={23} strokeWidth={1.7} /></button>
    <button className="task-copy" onClick={detail}><span className="task-title">{item.title}</span><span className="task-meta">{plan?.title ?? '已归档计划'}<i />{item.minutes} 分钟{item.actual > 0 ? ` · 实学 ${item.actual} 分` : ''}</span></button>
    <button className="check-button" role="checkbox" aria-checked={item.done} aria-label={`${item.done ? '取消完成' : '完成'}${item.title}`} onClick={toggle}><span>{item.done && <Check size={16} strokeWidth={2.5} />}</span></button>
  </article>
}
export function Brand({ small = false }: { small?: boolean }) { return <span className={`brand ${small ? 'small' : ''}`}><Sun size={small ? 17 : 22} strokeWidth={1.6} /><b>拾光</b><span>STUDYFLOW</span></span> }
export const Field = ({ label, children, help }: { label: string; children: ReactNode; help?: string }) => <label className="field"><span>{label}</span>{children}{help && <small>{help}</small>}</label>
export const SectionTitle = ({ title, extra }: { title: string; extra?: ReactNode }) => <div className="section-title"><h2>{title}</h2>{extra}</div>
